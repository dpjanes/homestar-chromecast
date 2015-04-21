/*
 *  SEE "model.js" for the best way to use this
 */

var Bridge = require('../ChromecastBridge').Bridge;

var bridge_exemplar = new Bridge();
bridge_exemplar.discovered = function(bridge) {
    console.log("+ got one\n ", bridge.meta());
    bridge.pulled = function(state) {
        console.log("+ state-change\n ", state);
    };
    bridge.connect();
    bridge.push({
        "load": "http://commondatastorage.googleapis.com/gtv-videos-bucket/big_buck_bunny_1080p.mp4",
        "volume": 0.5,
    });
};
bridge_exemplar.discover();
