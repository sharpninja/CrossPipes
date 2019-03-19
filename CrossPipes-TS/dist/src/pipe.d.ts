/// <reference types="node" />
import { Guid } from "guid-typescript";
import { Writable, Readable } from "stream";
export declare class Dispatcher {
    readonly Pipes: Array<Pipe>;
    readonly Errors: Array<CrossPipeError>;
    readonly IncompleteResponses: Array<Response>;
    readonly MismatchedPackets: Array<Packet>;
    private Handlers;
    private OutboundQueue;
    private readonly InStream;
    private readonly OutStream;
    private readonly ErrorStream;
    private readonly PushTimer;
    constructor(inStream: Readable, outStream: Writable, errorStream: Readable);
    private ErrorReceived;
    OnError(handler: {
        (error: CrossPipeError): void;
    }): void;
    OffError(handler: {
        (error: CrossPipeError): void;
    }): void;
    private TriggerError;
    GetPipe(name: string, id?: Guid, pipeDirection?: PipeDirection): Pipe;
    private AddPipe;
    AddPacket(packet: Packet): void;
    SendRequest(request: Request): void;
    SendResponse(response: Response): void;
}
export declare class CrossPipeError {
    Message: string;
    Data: any;
    constructor(message: string | undefined, data: any);
}
export declare class Pipe {
    readonly ID: Guid;
    readonly Name: string;
    readonly Direction: PipeDirection;
    readonly InboundListeners: Array<IListener>;
    readonly OutboundListeners: Array<IListener>;
    constructor(name: string, direction: PipeDirection | undefined, inboundListeners: Array<IListener>, outboundListeners: Array<IListener>);
    ReceiveRequestData(request: Request): void;
    ReceiveResponseData(response: Response): void;
}
export declare class Response {
    ID: Guid;
    private Packets;
    PacketCount: number;
    Data: any;
    BeginReceive: Date;
    FinishedReceive: Date;
    IsFinished: boolean;
    constructor(id: Guid, packet: Packet);
    HeaderBody: HeaderBody;
    AddPacket(packet: Packet): boolean;
    GetPackets(): Enumerator<Packet>;
}
export declare class Request {
    Name: string;
    ID: Guid;
    private Packets;
    BeginSend: Date;
    FinishedSend: Date;
    HeaderBody: HeaderBody;
    constructor(name: string, data: any);
    GetPackets(): Enumerator<Packet>;
}
declare class HeaderBody {
    PipeID: Guid;
    readonly Name: string;
    readonly PacketCount: number;
    constructor(pipeID: Guid, name: string, packetCount: number);
}
declare class Packet {
    ID: Guid;
    SequenceID: number;
    Body: any;
    constructor(data: string);
    static GetNewPacket(id: Guid, sequenceId: number, body: any): Packet;
}
export declare enum PipeDirection {
    Inbound = 0,
    Outbound = 1
}
export interface IListener {
    AcceptData(data: Request | Response): void;
}
export declare function GetDispatcher(inStream: Readable, outStream: Writable, errorStream: Readable): Dispatcher;
export {};
