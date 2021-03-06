import { Guid } from "guid-typescript";
import { Writable, Readable } from "stream";
import * as TDN from "typescript-dotnet-core";

const _packetSize = 65536;

export class Dispatcher {
    readonly Pipes: Array<Pipe> = new Array<Pipe>();
    readonly Errors: Array<CrossPipeError> = new Array<CrossPipeError>();

    readonly IncompleteResponses: Array<Response> = new Array<Response>();

    readonly MismatchedPackets: Array<Packet> = new Array<Packet>();

    private Handlers: Array<{ (error: CrossPipeError): void }> =
        new Array<{ (error: CrossPipeError): void }>();

    private OutboundQueue: Array<Packet> =
        new Array<Packet>();

    private readonly InStream: Readable;
    private readonly OutStream: Writable;
    private readonly ErrorStream: Readable;
    private readonly PushTimer: any;

    private static Instance: Dispatcher;

    private PartialPacketBuffer: string = "";

    private constructor(inStream: Readable, outStream: Writable, errorStream: Readable) {
        this.InStream = inStream;
        this.OutStream = outStream;
        this.ErrorStream = errorStream;

        this.InStream.setEncoding("utf8");
        this.InStream.on("data", data => {
            try {
                const sdata = this.PartialPacketBuffer + (data as string);
                const splitter = String.fromCharCode(0xFFFF);
                var sections = sdata.split(splitter);
                if (sdata.length === 1) {
                    this.PartialPacketBuffer = sdata[0];
                } else {
                    for (var i = 0; i < sdata.length - 1; ++i) {
                        var packet = Packet.FromString(sdata[i]);
                        this.AddPacket(packet);
                    }
                    this.PartialPacketBuffer = sdata[i];
                }
            }
            catch {
                this.ErrorReceived(new CrossPipeError(
                    "Could not create packet.",
                    data)
                );
            }
        });

        this.ErrorStream.on("data", data => {
            this.ErrorReceived(data);
        })

        this.PushTimer = setInterval((args) => {
            while (this.OutboundQueue.length > 0) {
                this.OutStream.write(this.OutboundQueue[0]);
                this.OutboundQueue.splice(0, 1);
            }
        }, 50);
    }

    public static CreateDispatcher(inStream: Readable, outStream: Writable, errorStream: Readable): Dispatcher {
        Dispatcher.Instance = new Dispatcher(inStream, outStream, errorStream);

        return Dispatcher.Instance;
    }

    public static GetInstance(): Dispatcher {
        if (this.Instance) {
            return this.Instance;
        }

        throw new CrossPipeError("Dispatcher not created yet", null);
    }

    private ErrorReceived(errorData: CrossPipeError | string): void {
        let error: CrossPipeError = typeof errorData === "string"
            ? new CrossPipeError("Undefined", errorData)
            : errorData;

        console.log(error);
        this.Errors.push(error);
        if (this.Errors.length > 20) {
            this.Errors.splice(0, this.Errors.length - 20);
        }
        this.TriggerError(error);
    }

    public OnError(handler: { (error: CrossPipeError): void }): void {
        this.Handlers.push(handler);
    }

    public OffError(handler: { (error: CrossPipeError): void }): void {
        this.Handlers = this.Handlers.filter(h => h != handler);
    }

    private TriggerError(error: CrossPipeError) {
        this.Handlers.forEach(h => h(error));
    }

    GetPipe(name: string, id: string = Guid.createEmpty().toString(), pipeDirection: PipeDirection = PipeDirection.Outbound): Pipe {
        const pipe: Pipe =
            this.Pipes.find(p => p.ID === id)
            || this.AddPipe(name, pipeDirection);

        return pipe;
    }

    private AddPipe(name: string, pipeDirection: PipeDirection): Pipe {
        const newPipe = new Pipe(name, pipeDirection, [], []);
        this.Pipes.push(newPipe);
        return newPipe;
    }

    AddPacket(packet: Packet): void {
        if (packet.SequenceID > 0) {
            let r = this.IncompleteResponses.find(r => r.ID === packet.ID);

            if (r) {
                r.AddPacket(packet);
            }
            else {
                const response = new Response(packet.ID, packet)

                const headerBody = response.HeaderBody;

                if (headerBody && headerBody.PacketCount === response.PacketCount) {
                    const toDeleteIndex = this.IncompleteResponses.indexOf(response);

                    if (toDeleteIndex) { this.IncompleteResponses.splice(toDeleteIndex, 1); }

                    const pipe: Pipe = this.Pipes.find(p => p.ID === headerBody.PipeID) ||
                        (null as unknown) as Pipe;

                    if (pipe !== null) {
                        pipe.ReceiveResponseData(response);
                    } else {
                        this.ErrorReceived(new CrossPipeError(
                            "Pipe (" + headerBody.PipeID.toString() + ") not found",
                            response));
                    }
                }

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
                        response.AddData(p.Body);
                        toRemove.push(counter);
                    }
                    counter++;
                });

            toRemove.sort((a, b) => b - a).forEach(
                p => this.MismatchedPackets.splice(p, 1));
        }
    }

    public SendRequest(request: Request): void {
        const pipe = this.Pipes.find(p => p.ID === request.HeaderBody.PipeID);

        if (pipe && pipe.Direction === PipeDirection.Inbound) {
            pipe.ReceiveRequestData(request);
        }
        else {
            const enumerator = request.GetPackets();

            enumerator.moveFirst();

            while (enumerator.atEnd() == false) {
                this.OutboundQueue.push(enumerator.item());
            };
        }
    }

    public SendResponse(response: Response): void {
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
            };
        }
    }
}

export class CrossPipeError {
    Message: string;
    Data: any;

    constructor(message: string = "Unspecified", data: any) {
        this.Message = message;
        this.Data = data || null;
    }
}

export class Pipe {
    readonly ID: string = Guid.create().toString();
    readonly Name: string;
    readonly Direction: PipeDirection;
    readonly InboundListeners: Array<IListener> =
        new Array<IListener>();
    readonly OutboundListeners: Array<IListener> =
        new Array<IListener>();

    constructor(name: string,
        direction: PipeDirection = PipeDirection.Outbound,
        inboundListeners: Array<IListener>,
        outboundListeners: Array<IListener>) {
        this.Name = name;
        this.Direction = direction;
        this.InboundListeners.concat(inboundListeners);
        this.OutboundListeners.concat(outboundListeners);
    }

    public ReceiveRequestData(request: Request) {
        request.HeaderBody.PipeID = this.ID;

        if (this.Direction === PipeDirection.Outbound) {
            Dispatcher.GetInstance().SendRequest(request);
        }
        else {
            this.InboundListeners.forEach(listener => listener.AcceptData(request));
        }
    }

    public ReceiveResponseData(response: Response) {
        if (this.Direction === PipeDirection.Outbound) {
            this.InboundListeners.forEach(listener => listener.AcceptData(response));
        }
        else {
            Dispatcher.GetInstance().SendResponse(response);
        }
    }
}

export class Response {
    ID: string;
    private Packets: Array<Packet> =
        new Array<Packet>();

    PacketCount: number = 0;

    Data: any;

    BeginReceive: Date;
    FinishedReceive: Date;

    IsFinished = this.FinishedReceive.toUTCString() !== new Date(0).toUTCString();

    constructor(id: string, requestHeaderPacket: Packet) {
        this.ID = id;
        this.Packets.push(requestHeaderPacket);
        this.BeginReceive = new Date();
        this.FinishedReceive = new Date(0);

        if (requestHeaderPacket.SequenceID !== 0) {
            this.HeaderBody = new HeaderBody(Guid.createEmpty().toString(), "", 0);
        } else {
            this.HeaderBody = requestHeaderPacket.Body as HeaderBody;
        }
    }

    HeaderBody: HeaderBody;

    public AddData(data: any): boolean {
        const newPacket = Packet.GetNewPacket(
            this.Packets[0].ID,
            this.Packets.length,
            data
        )

        return this.AddPacket(newPacket);
    }

    AddPacket(packet: Packet): boolean {
        if (packet.SequenceID === 0) {
            this.HeaderBody = packet.Body as HeaderBody;
            this.Packets.unshift(packet);
            return true;
        }

        this.Packets.push(packet);
        this.PacketCount = this.Packets.length;

        if (this.PacketCount === this.HeaderBody.PacketCount) {
            this.FinishedReceive = new Date();
            const dataSegments = new Array<string>();
            this.Packets.slice(1).forEach(p => dataSegments.push(p.Body));
            this.Data = JSON.parse(dataSegments.join());
            return true;
        }

        return false;
    }

    public GetPackets():  TDN.ArrayEnumerator<Packet> {
        return new TDN.ArrayEnumerator<Packet>(this.Packets);
    }
}

export class Request {
    Name: string;
    ID: string;
    private Packets: Array<Packet> =
        new Array<Packet>();

    BeginSend: Date;
    FinishedSend: Date;

    HeaderBody: HeaderBody;


    constructor(name: string, data: any) {
        this.BeginSend = new Date(0);
        this.FinishedSend = this.BeginSend;

        this.Name = name;
        this.ID = Guid.create().toString();

        const temp = "\0" + JSON.stringify(data);

        let current = 0;
        let length = 512;
        let slice: String;
        while (slice = temp.slice(current + 1, Math.min(length, temp.length - (current) * length))) {
            let packet = Packet.GetNewPacket(this.ID, current + 1, slice);
            current += slice.length;

            this.Packets.push(packet);
        }

        const packet = Packet.GetNewPacket(this.ID, 0, new HeaderBody(
            Guid.createEmpty().toString(),
            this.Name,
            this.Packets.length
        ));

        this.HeaderBody = packet.Body as HeaderBody;

        this.Packets.unshift(packet);
    }

    public GetPackets(): TDN.ArrayEnumerator<Packet> {
        return TDN.ArrayEnumerator<Packet>(this.Packets.slice(1));
    }

    public GetHeaderPacket(): Packet {
        return this.Packets[0];
    }
}

class HeaderBody {
    PipeID: string;
    readonly PipeName: string;
    readonly PacketCount: number;

    constructor(pipeID: string, pipeName: string, packetCount: number) {
        this.PipeID = pipeID;
        this.PipeName = pipeName;
        this.PacketCount = packetCount;
    }
}

class Packet {
    ID: string;
    SequenceID: number;
    Body: any;

    private constructor(data: string) {
        try {
            const temp = JSON.parse(data);

            if (temp.id && temp.body) {
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

    static GetNewPacket(id: string, sequenceId: number, body: any) {
        return new Packet(JSON.stringify({ id: id, sequenceId: sequenceId, body: body }));
    }

    static FromString(data: string) : Packet {
        return new Packet(data);
    }
}

export enum PipeDirection {
    Inbound, Outbound
}

export interface IListener {
    AcceptData(data: Request | Response): void;
}