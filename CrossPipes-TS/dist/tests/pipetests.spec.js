"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const alsatian_1 = require("alsatian");
const guid_typescript_1 = require("guid-typescript");
const Pip = __importStar(require("../src/pipe"));
const stream_1 = require("stream");
class PipeTestFixture {
    CreateDispatcher() {
        const dispatcher = TestHelpers.GetDispatcher();
        alsatian_1.Expect(dispatcher).toBeDefined();
    }
    BuildRequest() {
        try {
            const request = new Pip.Request("Test", {
                test: "Request"
            });
            alsatian_1.Expect(request).toBeDefined();
            alsatian_1.Expect(request).not.toBeNull();
            alsatian_1.Expect(request.HeaderBody).toBeDefined();
            alsatian_1.Expect(request.HeaderBody).not.toBeNull();
            alsatian_1.Expect(request.HeaderBody.PacketCount).toBe(1);
            alsatian_1.Expect(request.HeaderBody.PipeName).toBe("Test");
            alsatian_1.Expect(request.HeaderBody.PipeID).toBe(guid_typescript_1.Guid.createEmpty().toString());
        }
        catch (ex) {
            console.log(ex);
        }
    }
    BuildResponse() {
        try {
            const request = new Pip.Request("Test", {
                test: "Request"
            });
            request.GetPackets().moveFirst();
            var headerPacket = request.GetHeaderPacket();
            const response = new Pip.Response("Test", headerPacket);
            response.AddData({ response: "Response" });
            alsatian_1.Expect(response).toBeDefined();
            alsatian_1.Expect(response.HeaderBody).toBeDefined();
            alsatian_1.Expect(response.HeaderBody).not.toBeNull();
            alsatian_1.Expect(response.HeaderBody.PacketCount).toBe(1);
            alsatian_1.Expect(response.HeaderBody.PipeName).toBe("Test");
            alsatian_1.Expect(response.HeaderBody.PipeID).toBe(guid_typescript_1.Guid.createEmpty().toString());
        }
        catch (ex) {
            console.log(ex);
        }
    }
}
__decorate([
    alsatian_1.Test()
], PipeTestFixture.prototype, "CreateDispatcher", null);
__decorate([
    alsatian_1.Test()
], PipeTestFixture.prototype, "BuildRequest", null);
__decorate([
    alsatian_1.Test()
], PipeTestFixture.prototype, "BuildResponse", null);
exports.PipeTestFixture = PipeTestFixture;
class TestHelpers {
    static GetDispatcher() {
        const instream = StreamUtils.GetReadable();
        const errstream = StreamUtils.GetReadable();
        const outstream = StreamUtils.GetWritable();
        return Pip.Dispatcher.CreateDispatcher(instream, outstream, errstream);
    }
}
class RequestTransformer extends stream_1.Transform {
    constructor() {
        super();
    }
    _transform(chunk, encoding, next) {
        if (typeof chunk === Pip.Request.name) {
            const packets = chunk.GetPackets();
            packets.moveFirst();
            const response = new Pip.Response(guid_typescript_1.Guid.createEmpty().toString(), packets.item());
            packets.moveNext();
            while (!packets.atEnd()) {
                response.AddPacket(packets.item());
                packets.moveNext();
            }
            this.push(response);
        }
    }
}
class StreamUtils {
    static GetReadable() {
        return this._transform;
    }
    static GetWritable() {
        return this._transform;
    }
}
StreamUtils._transform = new RequestTransformer();
//# sourceMappingURL=pipetests.spec.js.map