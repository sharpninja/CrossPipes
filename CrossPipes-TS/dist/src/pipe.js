"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const guid_typescript_1 = require("guid-typescript");
class Dispatcher {
    constructor(inStream, outStream, errorStream) {
        this.Pipes = new Array();
        this.Errors = new Array();
        this.IncompleteResponses = new Array();
        this.MismatchedPackets = new Array();
        this.Handlers = new Array();
        this.OutboundQueue = new Array();
        this.InStream = inStream;
        this.OutStream = outStream;
        this.ErrorStream = errorStream;
        this.InStream.on("data", data => {
            try {
                var packet = new Packet(data);
                this.AddPacket(new Packet(data));
            }
            catch (_a) {
                this.ErrorReceived(new CrossPipeError("Could not create packet.", data));
            }
        });
        this.ErrorStream.on("data", data => {
            this.ErrorReceived(data);
        });
        this.PushTimer = setInterval((args) => {
            while (this.OutboundQueue.length > 0) {
                this.OutStream.write(this.OutboundQueue[0]);
                this.OutboundQueue.splice(0, 1);
            }
        }, 50);
    }
    static CreateDispatcher(inStream, outStream, errorStream) {
        Dispatcher.Instance = new Dispatcher(inStream, outStream, errorStream);
        return Dispatcher.Instance;
    }
    static GetInstance() {
        if (this.Instance) {
            return this.Instance;
        }
        throw new CrossPipeError("Dispatcher not created yet", null);
    }
    ErrorReceived(errorData) {
        let error = typeof errorData === "string"
            ? new CrossPipeError("Undefined", errorData)
            : errorData;
        console.log(error);
        this.Errors.push(error);
        if (this.Errors.length > 20) {
            this.Errors.splice(0, this.Errors.length - 20);
        }
        this.TriggerError(error);
    }
    OnError(handler) {
        this.Handlers.push(handler);
    }
    OffError(handler) {
        this.Handlers = this.Handlers.filter(h => h != handler);
    }
    TriggerError(error) {
        this.Handlers.forEach(h => h(error));
    }
    GetPipe(name, id = guid_typescript_1.Guid.createEmpty(), pipeDirection = PipeDirection.Outbound) {
        const pipe = this.Pipes.find(p => p.ID === id)
            || this.AddPipe(name, pipeDirection);
        return pipe;
    }
    AddPipe(name, pipeDirection) {
        const newPipe = new Pipe(name, pipeDirection, [], []);
        this.Pipes.push(newPipe);
        return newPipe;
    }
    AddPacket(packet) {
        if (packet.SequenceID > 0) {
            let r = this.IncompleteResponses.find(r => r.ID === packet.ID);
            if (!r) {
                this.MismatchedPackets.push(packet);
            }
            else {
                const response = r;
                r.AddPacket(packet);
                const headerBody = response.HeaderBody;
                if (headerBody) {
                    if (headerBody && headerBody.PacketCount === response.PacketCount) {
                        const toDeleteIndex = this.IncompleteResponses.indexOf(response);
                        if (toDeleteIndex) {
                            this.IncompleteResponses.splice(toDeleteIndex, 1);
                        }
                        const pipe = this.Pipes.find(p => p.ID == headerBody.PipeID) ||
                            null;
                        if (pipe !== null) {
                            pipe.ReceiveResponseData(response);
                        }
                        else {
                            this.ErrorReceived(new CrossPipeError("Pipe (" + headerBody.PipeID.toString() + ") not found", response));
                        }
                    }
                }
            }
        }
        else {
            const response = new Response(packet.ID, packet);
            const toRemove = new Array();
            let counter = 0;
            this.MismatchedPackets
                .sort((a, b) => a.SequenceID - b.SequenceID)
                .forEach(p => {
                if (p.ID === packet.ID) {
                    response.AddPacket(p);
                    toRemove.push(counter);
                }
                counter++;
            });
            toRemove.sort((a, b) => b - a).forEach(p => this.MismatchedPackets.splice(p, 1));
        }
    }
    SendRequest(request) {
        const pipe = this.Pipes.find(p => p.ID === request.HeaderBody.PipeID);
        if (pipe && pipe.Direction === PipeDirection.Inbound) {
            pipe.ReceiveRequestData(request);
        }
        else {
            const enumerator = request.GetPackets();
            enumerator.moveFirst();
            while (enumerator.atEnd() == false) {
                this.OutboundQueue.push(enumerator.item());
            }
            ;
        }
    }
    SendResponse(response) {
        const pipe = this.Pipes.find(p => p.ID === response.HeaderBody.PipeID);
        if (pipe && pipe.Direction === PipeDirection.Inbound) {
            pipe.ReceiveResponseData(response);
        }
        else {
            const enumerator = response.GetPackets();
            enumerator.moveFirst();
            while (enumerator.atEnd() == false) {
                this.OutboundQueue.push(enumerator.item());
                enumerator.moveNext();
            }
            ;
        }
    }
}
exports.Dispatcher = Dispatcher;
class CrossPipeError {
    constructor(message = "Unspecified", data) {
        this.Message = message;
        this.Data = data || null;
    }
}
exports.CrossPipeError = CrossPipeError;
class Pipe {
    constructor(name, direction = PipeDirection.Outbound, inboundListeners, outboundListeners) {
        this.ID = guid_typescript_1.Guid.create();
        this.InboundListeners = new Array();
        this.OutboundListeners = new Array();
        this.Name = name;
        this.Direction = direction;
        this.InboundListeners.concat(inboundListeners);
        this.OutboundListeners.concat(outboundListeners);
    }
    ReceiveRequestData(request) {
        request.HeaderBody.PipeID = this.ID;
        if (this.Direction === PipeDirection.Outbound) {
            Dispatcher.GetInstance().SendRequest(request);
        }
        else {
            this.InboundListeners.forEach(listener => listener.AcceptData(request));
        }
    }
    ReceiveResponseData(response) {
        if (this.Direction === PipeDirection.Outbound) {
            this.InboundListeners.forEach(listener => listener.AcceptData(response));
        }
        else {
            Dispatcher.GetInstance().SendResponse(response);
        }
    }
}
exports.Pipe = Pipe;
class Response {
    constructor(id, packet) {
        this.Packets = new Array();
        this.PacketCount = 0;
        this.IsFinished = this.FinishedReceive.toUTCString() !== new Date(0).toUTCString();
        if (packet.SequenceID === 0) {
            this.ID = id;
            this.Packets.push(packet);
            this.BeginReceive = new Date();
            this.FinishedReceive = new Date(0);
            this.HeaderBody = new HeaderBody(guid_typescript_1.Guid.createEmpty(), "", 0);
        }
        else {
            throw new CrossPipeError("Must receive header packet as first response.", packet);
        }
    }
    AddPacket(packet) {
        if (this.Packets.length === 0) {
            this.HeaderBody = this.Packets[0].Body;
        }
        this.Packets.push(packet);
        this.PacketCount = this.Packets.length;
        if (this.PacketCount === this.HeaderBody.PacketCount) {
            this.FinishedReceive = new Date();
            const dataSegments = new Array();
            this.Packets.slice(1).forEach(p => dataSegments.push(p.Body));
            this.Data = JSON.parse(dataSegments.join());
            return true;
        }
        return false;
    }
    GetPackets() {
        return new Enumerator(this.Packets);
    }
}
exports.Response = Response;
class Request {
    constructor(name, data) {
        this.Packets = new Array();
        this.BeginSend = new Date(0);
        this.FinishedSend = this.BeginSend;
        this.Name = name;
        this.ID = guid_typescript_1.Guid.create();
        const temp = JSON.stringify(data);
        let current = 1;
        let length = 512;
        let slice;
        while (slice = temp.slice(current, Math.min(length, temp.length - (current - 1) * length))) {
            let packet = Packet.GetNewPacket(this.ID, current, slice);
            current += slice.length;
            this.Packets.push(packet);
        }
        const packet = Packet.GetNewPacket(this.ID, 0, new HeaderBody(guid_typescript_1.Guid.createEmpty(), this.Name, this.Packets.length));
        this.HeaderBody = packet.Body;
        this.Packets.unshift(packet);
    }
    GetPackets() {
        return new Enumerator(this.Packets);
    }
}
exports.Request = Request;
class HeaderBody {
    constructor(pipeID, name, packetCount) {
        this.PipeID = pipeID;
        this.Name = name;
        this.PacketCount = packetCount;
    }
}
class Packet {
    constructor(data) {
        try {
            const temp = JSON.parse(data);
            if (temp.id && temp.sequenceId && temp.body) {
                this.ID = temp.id;
                this.SequenceID = temp.sequenceId;
                this.Body = temp.body;
            }
            else {
                throw "data is not a valid packet.";
            }
        }
        catch (ex) {
            throw "data is not a valid packet.";
        }
    }
    static GetNewPacket(id, sequenceId, body) {
        return new Packet(JSON.stringify({ id: id, sequenceId: sequenceId, body: body }));
    }
}
var PipeDirection;
(function (PipeDirection) {
    PipeDirection[PipeDirection["Inbound"] = 0] = "Inbound";
    PipeDirection[PipeDirection["Outbound"] = 1] = "Outbound";
})(PipeDirection = exports.PipeDirection || (exports.PipeDirection = {}));
//# sourceMappingURL=pipe.js.map