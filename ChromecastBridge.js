/*
 *  ChromecastBridge.js
 *
 *  David Janes
 *  IOTDB.org
 *  2015-04-19
 *
 *  Copyright [2013-2015] [David P. Janes]
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

"use strict";

var chromecastjs = require('chromecast-js')

var iotdb = require('iotdb');
var _ = iotdb._;
var bunyan = iotdb.bunyan;

var logger = bunyan.createLogger({
    name: 'homestar-chromecast',
    module: 'ChromecastBridge',
});

var mode_play = _.ld.expand("iot-attribute:media.mode.play");
var mode_pause = _.ld.expand("iot-attribute:media.mode.pause");
var mode_stop = _.ld.expand("iot-attribute:media.mode.stop");

/**
 *  EXEMPLAR and INSTANCE
 *  <p>
 *  No subclassing needed! The following functions are
 *  injected _after_ this is created, and before .discover and .connect
 *  <ul>
 *  <li><code>discovered</code> - tell IOTDB that we're talking to a new Thing
 *  <li><code>pulled</code> - got new data
 *  <li><code>connected</code> - this is connected to a Thing
 *  <li><code>disconnnected</code> - this has been disconnected from a Thing
 *  </ul>
 */
var ChromecastBridge = function (initd, native) {
    var self = this;

    self.initd = _.defaults(initd,
        iotdb.keystore().get("bridges/ChromecastBridge/initd"), {
            poll: 30
        }
    );
    self.native = native;   // the thing that does the work - keep this name

    if (self.native) {
        self.queue = _.queue("ChromecastBridge");
    }
};

/* --- lifecycle --- */

/**
 *  EXEMPLAR.
 *  <ul>
 *  <li>look for Things (using <code>self.bridge</code> data to initialize)
 *  <li>find / create a <code>native</code> that does the talking
 *  <li>create an ChromecastBridge(native)
 *  <li>call <code>self.discovered(bridge)</code> with it
 */
ChromecastBridge.prototype.discover = function () {
    var self = this;

    logger.info({
        method: "discover"
    }, "called");

    /*
     *  This is the core bit of discovery. As you find new
     *  thimgs, make a new ChromecastBridge and call 'discovered'.
     *  The first argument should be self.initd, the second
     *  the thing that you do work with
     */
    var browser = new chromecastjs.Browser()

    browser.on('deviceOn', function(device) {
        device.on('connected', function() {
            self.discovered(new ChromecastBridge(self.initd, device));
        });
        device.connect()
    });
};

/**
 *  INSTANCE
 *  This is called when the Bridge is no longer needed. When
 */
ChromecastBridge.prototype.connect = function (connectd) {
    var self = this;
    if (!self.native) {
        return;
    }

    self._setup_polling();
    self.pull();
};

ChromecastBridge.prototype._setup_polling = function () {
    var self = this;
    if (!self.initd.poll) {
        return;
    }

    var timer = setInterval(function () {
        if (!self.native) {
            clearInterval(timer);
            return;
        }

        self.pull();
    }, self.initd.poll * 1000);
};

ChromecastBridge.prototype._forget = function () {
    var self = this;
    if (!self.native) {
        return;
    }

    logger.info({
        method: "_forget"
    }, "called");

    self.native = null;
    self.pulled();
};

/**
 *  INSTANCE and EXEMPLAR (during shutdown).
 *  This is called when the Bridge is no longer needed.
 */
ChromecastBridge.prototype.disconnect = function () {
    var self = this;
    if (!self.native || !self.native) {
        return;
    }

    self._forget();
};

/* --- data --- */

/**
 *  INSTANCE.
 *  Send data to whatever you're taking to.
 */
ChromecastBridge.prototype.push = function (pushd) {
    var self = this;
    if (!self.native) {
        return;
    }

    logger.info({
        method: "push",
        pushd: pushd
    }, "push");

    // note: play - play a media file; node=play is "unpause"
    if (pushd.play !== undefined) {
        self._push_play(pushd.play);
    }

    if (pushd.mute !== undefined) {
        self._push_mute(pushd.mute);
    }

    if (pushd.volume !== undefined) {
        self._push_volume(pushd.volume);
    }

    if (pushd.mode === mode_play) {
        self._push_mode_play();
    } else if (pushd.mode === mode_pause) {
        self._push_mode_pause();
    } else if (pushd.mode === mode_stop) {
        self._push_mode_stop();
    }
};

ChromecastBridge.prototype._push_play = function (iri) {
    var self = this;

    self.queue.add({
        id: "_push_play",
        run: function (queue, qitem) {
            self.native.play(iri, 0, function (error, data) {
                self.queue.finished(qitem);

                if (error) {
                    logger.error({
                        method: "_push_play/callback",
                        error: error,
                    }, "Chromecast error");
                } else {
                    self.pulled({
                        play: null,
                    });
                }
            });
        }
    });
};

ChromecastBridge.prototype._push_volume = function (volume) {
    var self = this;

    self.queue.add({
        id: "_push_volume",
        run: function (queue, qitem) {
            self.native.setVolume(volume, function (error, data) {
                self.queue.finished(qitem);

                if (error) {
                    logger.error({
                        method: "_push_volume/callback",
                        error: error,
                    }, "Chromecast error");
                } else {
                    self.pulled({
                        volume: volume,
                    });
                }
            });
        }
    });
};

ChromecastBridge.prototype._push_mute = function (mute) {
    var self = this;

    self.queue.add({
        id: "_push_mute",
        run: function (queue, qitem) {
            self.native.setMuted(mute, function (error, data) {
                self.queue.finished(qitem);

                if (error) {
                    logger.error({
                        method: "_push_mute/callback",
                        error: error,
                    }, "Chromecast error");
                } else {
                    self.pulled({
                        mute: mute,
                    });
                }
            });
        }
    });
};

ChromecastBridge.prototype._push_mode_play = function () {
    var self = this;

    self.queue.add({
        id: "_push_mode",
        run: function (queue, qitem) {
            self.native.unpause(function (error, data) {
                self.queue.finished(qitem);

                if (error) {
                    logger.error({
                        method: "_push_mode_play/callback",
                        error: error,
                    }, "Chromecast error");
                } else {
                    self.pulled({
                        mode: mode_play,
                    });
                }
            });
        }
    });
};

ChromecastBridge.prototype._push_mode_pause = function () {
    var self = this;

    self.queue.add({
        id: "_push_mode",
        run: function (queue, qitem) {
            self.native.pause(function (error, data) {
                self.queue.finished(qitem);

                if (error) {
                    logger.error({
                        method: "_push_mode_pause/callback",
                        error: error,
                    }, "Chromecast error");
                } else {
                    self.pulled({
                        mode: mode_pause,
                    });
                }
            });
        }
    });
};

ChromecastBridge.prototype._push_mode_stop = function () {
    var self = this;

    self.queue.add({
        id: "_push_mode",
        run: function (queue, qitem) {
            self.native.stop(function (error, data) {
                self.queue.finished(qitem);

                if (error) {
                    logger.error({
                        method: "_push_mode_stop/callback",
                        error: error,
                    }, "Chromecast error");
                } else {
                    self.pulled({
                        mode: mode_stop,
                    });
                }
            });
        }
    });
};


/**
 *  INSTANCE.
 *  Pull data from whatever we're talking to. You don't
 *  have to implement this if it doesn't make sense
 */
ChromecastBridge.prototype.pull = function () {
    var self = this;
    if (!self.native) {
        return;
    }
};

/* --- state --- */

/**
 *  INSTANCE.
 *  Return the metadata - compact form can be used.
 *  Does not have to work when not reachable
 *  <p>
 *  Really really useful things are:
 *  <ul>
 *  <li><code>iot:thing</code> required - a unique ID
 *  <li><code>iot:device</code> suggested if linking multiple things together
 *  <li><code>schema:name</code>
 *  <li><code>iot:number</code>
 *  <li><code>schema:manufacturer</code>
 *  <li><code>schema:model</code>
 */
ChromecastBridge.prototype.meta = function () {
    var self = this;
    if (!self.native) {
        return;
    }

    console.log("NATIVE", self.native);

    return {
        "iot:thing": _.id.thing_urn.network_unique("Chromecast", self.native.config.name),
        "schema:name": self.native.config.name || "Chromecast",

        // other possibilites
        // "iot:thing": _.id.thing_urn.unique("Chromecast", self.native.uuid, self.initd.number),
        // "iot:number": self.initd.number,
        // "iot:device": _.id.thing_urn.unique("Chromecast", self.native.uuid),
        // "schema:manufacturer": "",
    };
};

/**
 *  INSTANCE.
 *  Return True if this is reachable. You
 *  do not need to worry about connect / disconnect /
 *  shutdown states, they will be always checked first.
 */
ChromecastBridge.prototype.reachable = function () {
    return this.native !== null;
};

/**
 *  INSTANCE.
 *  Configure an express web page to configure this Bridge.
 *  Return the name of the Bridge, which may be
 *  listed and displayed to the user.
 */
ChromecastBridge.prototype.configure = function (app) {};

/* --- injected: THIS CODE WILL BE REMOVED AT RUNTIME, DO NOT MODIFY  --- */
ChromecastBridge.prototype.discovered = function (bridge) {
    throw new Error("ChromecastBridge.discovered not implemented");
};

ChromecastBridge.prototype.pulled = function (pulld) {
    throw new Error("ChromecastBridge.pulled not implemented");
};

/*
 *  API
 */
exports.Bridge = ChromecastBridge;
