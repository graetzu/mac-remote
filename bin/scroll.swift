import CoreGraphics
import ApplicationServices

let promptKey = kAXTrustedCheckOptionPrompt.takeUnretainedValue() as NSString
let trusted = AXIsProcessTrustedWithOptions([promptKey: true] as CFDictionary)
if !trusted {
    FileHandle.standardError.write("scrollhelper: keine Bedienungshilfen-Berechtigung\n".data(using: .utf8)!)
    exit(1)
}

let args = CommandLine.arguments
guard args.count >= 3, let dy = Int32(args[1]), let dx = Int32(args[2]) else {
    exit(1)
}

if let source = CGEventSource(stateID: .hidSystemState),
   let event = CGEvent(
     scrollWheelEvent2Source: source,
     units: .pixel,
     wheelCount: 2,
     wheel1: dy,
     wheel2: dx,
     wheel3: 0
   ) {
    event.setIntegerValueField(.scrollWheelEventIsContinuous, value: 1)
    event.setIntegerValueField(.scrollWheelEventPointDeltaAxis1, value: Int64(dy))
    event.setIntegerValueField(.scrollWheelEventPointDeltaAxis2, value: Int64(dx))
    event.setDoubleValueField(.scrollWheelEventFixedPtDeltaAxis1, value: Double(dy))
    event.setDoubleValueField(.scrollWheelEventFixedPtDeltaAxis2, value: Double(dx))
    event.post(tap: .cghidEventTap)
}
