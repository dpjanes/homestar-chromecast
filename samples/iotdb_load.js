/*
 *  Note: to work, this package must have been installed by 'homestar install' 
 */

"use strict";

var iotdb = require("iotdb");

var things = iotdb.connect("Chromecast");
things.on("state", function (thing) {
    console.log("+ state\n ", thing.thing_id(), "\n ", thing.state("istate"));
});
things.on("meta", function (thing) {
    console.log("+ meta\n ", thing.thing_id(), thing.state("meta"));
});
things.on("thing", function (thing) {
    console.log("+ discovered\n ", thing.thing_id(), thing.state("meta"));

    thing.set(":media.play", "http://commondatastorage.googleapis.com/gtv-videos-bucket/big_buck_bunny_1080p.mp4");
});
