import { Guid } from "guid-typescript";
import { Writable, Readable } from "stream";

export function GetDispatcher(inStream: Readable, outStream: Writable) : Dispatcher {
    return new Dispatcher(inStream, outStream);
};

class Dispatcher {
    readonly InputPipes: Array<Pipe> = new Array<Pipe>();
    readonly OutputPipes: Array<Pipe> = new Array<Pipe>();

    readonly IncompleteResponses: Array<Response> = new Array<Response>();

    readonly MismatchedPackets: Array<Packet> = new Array<Packet>();

    private readonly InStream: Readable;
    private readonly OutStream: Writable;
    private readonly ErrorStream: Readable;

    constructor(inStream: Readable, outStream: Writable, errorStream: Readable) {
        this.InStream = inStream;
        this.OutStream = outStream;
        this.ErrorStream = errorStream;
    }

    GetPipe(name: string, pipeDirection: PipeDirection): Pipe {
        if (pipeDirection === PipeDirection.Input) {
            const pipe: Pipe =
                this.InputPipes.find(p => p.Name === name)
                || this.AddPipe(name, pipeDirection);

            return pipe;
        }

        return this.OutputPipes.find(p => p.Name === name)
            || this.AddPipe(name, pipeDirection);
    }

    private AddPipe(name: string, pipeDirection: PipeDirection): Pipe {
        const newPipe = new Pipe(name, pipeDirection, [], []);
        if (pipeDirection === PipeDirection.Input) this.InputPipes.push(newPipe);
        else this.OutputPipes.push(newPipe);
        return newPipe;
    }

    AddPacket(packet: Packet) {
        if (packet.SequenceID > 0) {
            let r = this.IncompleteResponses.find(r => r.ID === packet.ID);

            if (!r) {
                this.MismatchedPackets.push(packet);
            }
            else {
                const response = r as Response;

                r.AddPacket(packet);
            }
        }
        else {
            const response = new Response(packet.ID, packet);
            const toRemove = new Array<number>();

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

            toRemove.forEach(p => this.MismatchedPackets.splice(p, 1));
        }
    }
}

export class Pipe {
    readonly Name: string;
    readonly Direction: PipeDirection;
    readonly InboundListeners: Array<IListener> =
        new Array<IListener>();
    readonly OutboundListeners: Array<IListener> =
        new Array<IListener>();

    constructor(name: string,
        direction: PipeDirection = PipeDirection.Output,
        inboundListeners: Array<IListener>,
        outboundListeners: Array<IListener>) {
        this.Name = name;
        this.Direction = direction;
        this.InboundListeners.concat(inboundListeners);
        this.OutboundListeners.concat(outboundListeners);
    }

    ReceiveRequestData(request: Request) {
        if (this.Direction === PipeDirection.Output) {
            this.OutboundListeners.forEach(listener => listener.AcceptData(request));
        }
        else {
            this.InboundListeners.forEach(listener => listener.AcceptData(request));
        }
    }

    ReceiveResponseData(response: Response) {
        if (this.Direction === PipeDirection.Output) {
            this.InboundListeners.forEach(listener => listener.AcceptData(response));
        }
        else {
            this.OutboundListeners.forEach(listener => listener.AcceptData(response));
        }
    }
}

export class Response {
    ID: Guid;
    Packets: Array<Packet> =
        new Array<Packet>();

    BeginReceive: Date;
    FinishedReceive: Date;

    IsFinished = this.FinishedReceive.toUTCString() !== new Date(0).toUTCString();

    constructor(id: Guid, packet: Packet) {
        if (packet.SequenceID === 0) {
            this.ID = id;
            this.Packets.push(packet);
            this.BeginReceive = new Date();
            this.FinishedReceive = new Date(0);
        }
        else {
            throw "Must receive header packet as first response.";
        }
    }

    AddPacket(packet: Packet) {
        this.Packets.push(packet);

        const header: HeaderBody = this.Packets[0].Body;

        if (this.Packets.length === header.PacketCount) {
            this.FinishedReceive = new Date();
        }
    }
}

export class Request {
    Name: string;
    ID: Guid;
    Packets: Array<Packet> =
        new Array<Packet>();

    BeginSend: Date;
    FinishedSend: Date;

    constructor(name: string, data: any) {
        this.BeginSend = new Date(0);
        this.FinishedSend = this.BeginSend;

        this.Name = name;
        this.ID = Guid.create();

        const temp = JSON.stringify(data);

        let current = 1;
        let length = 512;
        let slice: String;
        while (slice = temp.slice(current, Math.min(length, temp.length - (current - 1) * length))) {
            let packet = Packet.GetNewPacket(this.ID, current, slice);
            current += slice.length;

            this.Packets.push(packet);
        }

        const packet = Packet.GetNewPacket(this.ID, 0, {
            Name: this.Name,
            PacketCount: this.Packets.length
        });

        this.Packets.unshift(packet);
    }
}

export class HeaderBody {
    readonly PipeName: string;
    readonly Name: string;
    readonly PacketCount: number;

    constructor(pipeName: string, name: string, packetCount: number) {
        this.PipeName = pipeName;
        this.Name = name;
        this.PacketCount = packetCount;
    }
}

export class Packet {
    ID: Guid;
    SequenceID: number;
    Body: any;

    constructor(data: string) {
        try {
            const temp = JSON.parse(data);

            if (temp.id && temp.sequenceId && temp.body) {
                this.ID = temp.id;
                this.SequenceID = temp.sequenceId;
                this.Body = temp.body;
            } else {
                throw "data is not a valid packet."
            }
        }
        catch (ex) {
            throw "data is not a valid packet."
        }
    }

    static GetNewPacket(id: Guid, sequenceId: number, body: any) {
        return new Packet(JSON.stringify({ id: id, sequenceId: sequenceId, body: body }));
    }
}

export enum PipeDirection {
    Input, Output
}

export interface IListener {
    AcceptData(data: Request | Response): void;
}