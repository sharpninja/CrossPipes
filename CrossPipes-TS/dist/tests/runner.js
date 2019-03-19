var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { TapBark } from "tap-bark";
import { TestSet, TestRunner } from "alsatian";
(() => __awaiter(this, void 0, void 0, function* () {
    const testSet = TestSet.create();
    testSet.addTestsFromFiles('./tests/**/*.spec.ts');
    const testRunner = new TestRunner();
    testRunner.outputStream
        .pipe(TapBark.create().getPipeable())
        .pipe(process.stdout);
    yield testRunner.run(testSet);
}))().catch(e => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=runner.js.map