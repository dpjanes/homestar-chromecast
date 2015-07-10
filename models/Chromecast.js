/*
 *  Chromecast.js
 *
 *  David Janes
 *  IOTDB
 *  2015-04-19
 */

var iotdb = require("iotdb");
var _ = iotdb._;

exports.Model = iotdb.make_model('Chromecast')
    .facet(":media")
    .name("Chromecast")
    .io("volume", iotdb.number.unit.volume)
    .io("mute", iotdb.boolean.mute)
    .io("load", iotdb.make_iri(":media.load"))
    .action("iot-attribute:media.play")
    .action("iot-attribute:media.pause")
    .action("iot-attribute:media.stop")
    .make();

exports.binding = {
    bridge: require('../ChromecastBridge').Bridge,
    model: exports.Model,
};
