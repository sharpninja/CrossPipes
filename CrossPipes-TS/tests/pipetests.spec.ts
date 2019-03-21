import { Expect, Test } from "alsatian";
import { Guid } from "guid-typescript";
import * as Pip from "../src/pipe";
import { Writable, Readable, Transform } from "stream";
import { basename } from "path";

export class PipeTestFixture {

    @Test()
    public CreateDispatcher() {
        const dispatcher = TestHelpers.GetDispatcher();
        Expect(dispatcher).toBeDefined();
    }

    @Test()
    public BuildRequest() {
        try {
            const request = new Pip.Request("Test", {
                test: "Request"
            });

            Expect(request).toBeDefined();
            Expect(request).not.toBeNull();
            Expect(request.HeaderBody).toBeDefined();
            Expect(request.HeaderBody).not.toBeNull();
            Expect(request.HeaderBody.PacketCount).toBe(1);
            Expect(request.HeaderBody.PipeName).toBe("Test");
            Expect(request.HeaderBody.PipeID).toBe(Guid.createEmpty().toString());
        }
        catch (ex) { console.log(ex); }
    }

    @Test()
    public BuildResponse() {
        try {
            const request = new Pip.Request("Test", {
                test: "Request"
            });

            request.GetPackets().moveFirst();
            var headerPacket = request.GetHeaderPacket();

            const response = new Pip.Response("Test", headerPacket);

            response.AddData({ response: "Response" });

            Expect(response).toBeDefined();
            Expect(response.HeaderBody).toBeDefined();
            Expect(response.HeaderBody).not.toBeNull();
            Expect(response.HeaderBody.PacketCount).toBe(1);
            Expect(response.HeaderBody.PipeName).toBe("Test");
            Expect(response.HeaderBody.PipeID).toBe(Guid.createEmpty().toString());
        }
        catch(ex) {
            console.log(ex);
        }
    }
}

class TestHelpers {
    public static GetDispatcher(): Pip.Dispatcher {
        const instream = StreamUtils.GetReadable();
        const errstream = StreamUtils.GetReadable();
        const outstream = StreamUtils.GetWritable();

        return Pip.Dispatcher.CreateDispatcher(instream, outstream, errstream);
    }
}

class RequestTransformer extends Transform {
    constructor() {
        super();
    }

    _transform(chunk: Pip.Request, encoding: string, next: (error?: Error) => void) {
        if (typeof chunk === Pip.Request.name) {
            const packets = chunk.GetPackets();
            packets.moveFirst();

            const response = new Pip.Response(Guid.createEmpty().toString(), packets.item());
            packets.moveNext();

            while (!packets.atEnd()) {
                response.AddPacket(packets.item())
                packets.moveNext();
            }

            this.push(response);
        }
    }
}

class StreamUtils {
    private static _transform = new RequestTransformer();

    public static GetReadable(): Readable {
        return this._transform;
    }

    public static GetWritable(): Writable {
        return this._transform;
    }
}

