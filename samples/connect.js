/*
 *  SEE "model.js" for the best way to use this
 */

var Bridge = require('../ChromecastBridge').Bridge;

var bridge_exemplar = new Bridge();
bridge_exemplar.discovered = function(bridge) {
    console.log("+ got one\n ", bridge.meta());
    /*
    bridge.pulled = function(state) {
        console.log("+ state-change\n ", state);
    };
    bridge.connect();

    var on = false;
    setInterval(function() {
        bridge.push({
            on: on,
        });
        on = !on;
    }, 2500);
    */
};
bridge_exemplar.discover();
