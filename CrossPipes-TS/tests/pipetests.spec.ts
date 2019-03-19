import { Expect, Test } from "alsatian";
import * as Pip from "../src/pipe";
import { Writable, Readable } from "stream";

export class PipeTestFixture {

    @Test()
    public CreateDispatcher() {
        const instream = StreamUtils.GetReadable();
        const errstream = StreamUtils.GetReadable();
        const outstream = StreamUtils.GetWritable();

        const dispatcher = Pip.Dispatcher.CreateDispatcher(instream, outstream, errstream);

        Expect(dispatcher).toBeDefined();
    }

}

class StreamUtils {
    public static GetReadable() : Readable {
        const stream = new ReadableStream();

        const readable = 

        return stream;
    }

    public static GetWritable() : WritableStream {
        return new WritableStream().getWriter();
    }
}