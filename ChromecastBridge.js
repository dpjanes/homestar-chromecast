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

var mode_play = "iot-attribute:media.mode.play";
var mode_pause = "iot-attribute:media.mode.pause";
var mode_stop = "iot-attribute:media.mode.stop";

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
    var cp = iotdb.module("iotdb-upnp").control_point();

    cp.on("device", function (native) {
        if (native.deviceType !== "urn:dial-multiscreen-org:device:dial:1") {
            return;
        } else if (native.manufacturer !== 'Google Inc.') {
            return;
        }

        var device = new chromecastjs.Device({
            addresses: [ native.host, ],
            name: native.friendlyName,
            manufacturer: native.manufacturer,
            uuid: native.uuid,
            modelName: native.modelName,
        });

        device.on('connected', function() {
            self.discovered(new ChromecastBridge(self.initd, device));
        });
        device.connect()
    });
    cp.search();
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

    if (pushd.load !== undefined) {
        self._push_load(pushd.load);
    }

    if (pushd.mute !== undefined) {
        self._push_mute(pushd.mute);
    }

    if (pushd.volume !== undefined) {
        self._push_volume(pushd.volume);
    }

    var mode = _.ld.compact(pushd.mode);
    if (mode === mode_play) {
        self._push_mode_play();
    } else if (mode === mode_pause) {
        self._push_mode_pause();
    } else if (mode === mode_stop) {
        self._push_mode_stop();
    }
};

ChromecastBridge.prototype._push_load = function (iri) {
    var self = this;

    self.queue.add({
        id: "_push_load",
        run: function (queue, qitem) {
            self.native.play(iri, 0, function (error, data) {
                self.queue.finished(qitem);

                if (error) {
                    logger.error({
                        method: "_push_load/callback",
                        error: error,
                    }, "Chromecast error");
                } else {
                    self.pulled({
                        "load": iri,
                    });
                    self.pull();
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
                    self.pull();
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
            self.native.setVolumeMuted(mute, function (error, data) {
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
                    self.pull();
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
                    self.pull();
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
                    self.pull();
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
                    self.pull();
                }

            });
        }
    });
};


/**
 *  INSTANCE.
 *  Pull data from whatever we're talking to. You don't
 *  have to implement this if it doesn't make sense
 *
 *  Way more information could be used:
   { mediaSessionId: 1,
     playbackRate: 1,
     playerState: 'BUFFERING',
     currentTime: 60,
     supportedMediaCommands: 15,
     volume: { level: 1, muted: false },
     activeTrackIds: [],
     media: 
      { contentId: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/big_buck_bunny_1080p.mp4',
        contentType: 'video/mp4',
        duration: 596.501333 } } }
    });
 */
ChromecastBridge.prototype.pull = function () {
    var self = this;
    if (!self.native) {
        return;
    }

    self.queue.add({
        id: "_pull",
        run: function (queue, qitem) {
            self.native.getStatus(function(d) {
                process.nextTick(function() {
                    self.queue.finished(qitem);
                });
                if (!d) {
                    self.pulled({
                        volume: null,
                        mute: null,
                        load: null,
                    });
                    return;
                }

                var pulld = {};

                if (d.volume) {
                    pulld.volume = d.volume.level;
                    pulld.mute = d.volume.muted;
                }
                
                if (d.media) {
                    pulld.load = d.media.contentId;
                }

                self.pulled(pulld);
            });
        }
    });
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

    return {
        "iot:thing": _.id.thing_urn.unique("Chromecast", self.native.config.uuid),
        "schema:name": self.native.config.name || "Chromecast",
        "schema:manufacturer": self.native.config.manufacturer,
        "schema:model": self.native.config.modelName,
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
