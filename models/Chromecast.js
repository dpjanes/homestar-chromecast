/*
 *  Template.js
 *
 *  David Janes
 *  IOTDB
 *  YYYY-MM-DD
 */

var iotdb = require("iotdb");

exports.Model = iotdb.make_model('LIFXLight')
    // .facet(":lighting")
    .name("Template")
    // .description("Template")
    .io("on", iotdb.boolean.on)
    .make();

exports.binding = {
    bridge: require('../TemplateBridge').Bridge,
    model: exports.Model,
};
