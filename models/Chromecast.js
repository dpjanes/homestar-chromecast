/*
 *  Chromecast.js
 *
 *  David Janes
 *  IOTDB
 *  2015-04-19
 */

var iotdb = require("iotdb");
var _ = iotdb._;

exports.Model = iotdb.make_model('LIFXLight')
    // .facet(":lighting")
    .name("Chromecast")
    // .description("Chromecast")
    // .io("on", iotdb.boolean.on)
    .io("volume", iotdb.number.unit.volume)
    .io("mute", iotdb.boolean.mute)
    .io("mode",
        iotdb
            .make_string(":media.mode")
            .enumeration(_.ld.expand([
                "iot-attribute:media.mode.play",
                "iot-attribute:media.mode.pause",
                "iot-attribute:media.mode.stop",
            ]))
    )
    .make();

exports.binding = {
    bridge: require('../ChromecastBridge').Bridge,
    model: exports.Model,
};
