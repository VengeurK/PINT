import * as express from 'express';
import * as socketio from 'socket.io';
import * as http from 'http';
import * as path from 'path';
import * as serveStatic from 'serve-static';
import {Vec2} from "../client/ts/vec2";
import {Project} from "../client/ts/docState";
import {ActionNetworkPacket, HelloNetworkPacket} from "../client/ts/actionLink/networkLink";
import {PixelSelectionHandler} from "../client/ts/selection/selection";
import {ActionType} from "../client/ts/tools/actionInterface";
import {PintHistory} from "../client/ts/history/history";

let app = express();

const port = process.env.PORT || 8080;

let server = http.createServer(app);
let io: SocketIO.Server = socketio(server);

server.listen(port, function () {
    console.log('Server listening on port %d', port);
});

app.use('/src/', serveStatic(path.join(__dirname, '../../src/')));
app.use('/', serveStatic(path.join(__dirname, '../client/')));


let clients: { [pid: string]: { [uid: string]: SocketIO.Socket } } = {};
let projects: { [pid: string]: Project } = {};
let selectionHandlers: { [uid: string]: PixelSelectionHandler } = {};
let histories: { [pid: string]: PintHistory } = {};
let client_project: { [uid: string]: string } = {};

let names: Map<string, string> = new Map();
let colors: Map<string, string> = new Map();

interface JoinPacket {
    name: string;
    dimensions: { x: number, y: number };
    image_data: string;
}

let Moniker: any = require("moniker");
let name_generator: any = Moniker.generator([Moniker.adjective, Moniker.noun]);

let color_generator = require('randomcolor');

io.on("connection", function (socket: SocketIO.Socket) {
    let name = name_generator.choose();

    console.log(socket.id + " connected. His name is "+name);

    names.set(socket.id, name);
    colors.set(socket.id, color_generator());

    socket.on("join", function (packet: JoinPacket) {
        /**
         * Project creation.
         */
        if (projects[packet.name] === undefined) {
            console.log(socket.id + " creates the drawing `" + packet.name + "`");
            let project = new Project(null, packet.name, new Vec2(packet.dimensions.x, packet.dimensions.y));
            let history: PintHistory = new PintHistory(project);

            projects[packet.name] = project;
            histories[packet.name] = history;
            clients[packet.name] = {};
        }

        /**
         * Client synchronization to drawing
         */
        console.log(names.get(socket.id) + " joining drawing `" + packet.name + "`");

        let data = {
            dimensions: projects[packet.name].dimensions,
            data: [],
            infos: [],
            name: names.get(socket.id),
            color: colors.get(socket.id),
        };

        // Send all layers
        for (let i = 0; i < projects[packet.name].layerList.length; i++) {
            data.data.push(projects[packet.name].layerList[i].getHTMLElement().toDataURL());
            data.infos.push(projects[packet.name].layerList[i].layerInfo.data());
        }

        socket.emit("joined", data);

        /**
         * Client to client synchronization of selection
         */
        for (let id in clients[packet.name]) {
            let hello: HelloNetworkPacket = {
                sender: id,
                serializedSelection: selectionHandlers[id].serialize(),
                name: names.get(id),
                color: colors.get(id),
            };
            socket.emit("hello", hello);
        }


        selectionHandlers[socket.id] = new PixelSelectionHandler(data.dimensions.x, data.dimensions.y);

        let hello: HelloNetworkPacket = {
            sender: socket.id,
            serializedSelection: selectionHandlers[socket.id].serialize(),
            name: names.get(socket.id),
            color: colors.get(socket.id),
        };

        for (let id in clients[packet.name]) {
            clients[packet.name][id].emit("hello", hello);
        }

        clients[packet.name][socket.id] = socket;
        client_project[socket.id] = packet.name;

        /**
         * Loaded image into project. (Load from file option)
         */
        if (packet.image_data !== "") {
            let actionPacket: ActionNetworkPacket = {
                data: {
                    type: ActionType.ToolApply,
                    toolName: "PasteTool",
                    actionData: {x: 0, y: 0},
                    toolSettings: {
                        project_clipboard: packet.image_data,
                        project_clipboard_x: 0,
                        project_clipboard_y: 0,
                    },
                },
                sender: socket.id,
            };

            for (let socket_id in clients[packet.name]) {
                clients[packet.name][socket_id].emit("action", actionPacket);
            }

            projects[packet.name].applyAction(actionPacket.data, selectionHandlers[actionPacket.sender], false).then(null);
        }
    });

    socket.on("disconnect", function () {
        console.log(socket.id + " left.");
    });


    socket.on("action", function (data: ActionNetworkPacket) {
        if (data.sender !== socket.id) {
            console.warn("Some guy is trying to fuck everything up.");
            console.warn("Socket:" + socket.id);
            console.warn("Sender:" + data.sender);
            return;
        }

        let name = client_project[socket.id];
        if (name == undefined || name == null) {
            console.warn("Project name not found. User might not be in a project.");
            return;
        }

        if (projects[name] == undefined || projects[name] == null) {
            console.error("Project manager " + name + " not found.");
            return;
        }

        let history = histories[name];
        if (history == undefined || history == null) {
            console.error("History manager not found for project " + name);
            return;
        }

        if (data.data.type != ActionType.ToolPreview) {
            console.log("On project: " + name);
            console.log("Action by " + names.get(data.sender) + " with tool " + data.data.toolName);
        }

        if (data.data.type == ActionType.Undo) {
            let action_packet = history.undo();
            if (action_packet != null) {
                projects[name].applyAction(action_packet.data, selectionHandlers[action_packet.sender], false).then(_ => {
                    for (let socket_id in clients[name]) {
                        clients[name][socket_id].emit("action", action_packet);
                    }
                });
            }
        } else if (data.data.type == ActionType.Redo) {
            let action_packet = history.redo();

            if (action_packet != null) {
                projects[name].applyAction(action_packet.data, selectionHandlers[action_packet.sender], false).then(null);
                for (let socket_id in clients[name]) {
                    clients[name][socket_id].emit("action", action_packet);
                }
            }
        } else {
            for (let socket_id in clients[name]) {
                clients[name][socket_id].emit("action", data);
            }
            if (data.data.type != ActionType.ToolPreview) {
                projects[name].applyAction(data.data, selectionHandlers[data.sender], true).then(undo_action => {
                    history.register_action(data, undo_action);
                });
            } else if (data.data.type == ActionType.ToolPreview) {
                projects[name].applyAction(data.data, selectionHandlers[data.sender], false).then(null);
            }

        }
    })
});