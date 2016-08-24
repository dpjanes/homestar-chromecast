/*
 *  Note: to work, this package must have been installed by 'homestar install' 
 */

"use strict";

const iotdb = require("iotdb");
iotdb.use("homestar-chromecast");

const things = iotdb.connect("Chromecast");
things.on("istate", function (thing) {
    console.log("+", "istate\n ", thing.thing_id(), "\n ", thing.state("istate"));
});
things.on("meta", function (thing) {
    console.log("+ meta\n ", thing.thing_id(), thing.state("meta"));
});
things.on("thing", function (thing) {
    console.log("+ discovered\n ", thing.thing_id(), thing.state("meta"));

    thing.set(":media.load", "http://commondatastorage.googleapis.com/gtv-videos-bucket/big_buck_bunny_1080p.mp4");
});
