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
const Pip = __importStar(require("../src/pipe"));
class PipeTestFixture {
    CreateDispatcher() {
        const dispatcher = Pip.Dispatcher.GetInstance();
        alsatian_1.Expect(dispatcher).toBeDefined();
    }
}
__decorate([
    alsatian_1.Test()
], PipeTestFixture.prototype, "CreateDispatcher", null);
exports.PipeTestFixture = PipeTestFixture;
//# sourceMappingURL=pipetests.spec.js.map