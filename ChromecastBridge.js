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

var chromecastjs = require('chromecast-js');

var iotdb = require('iotdb');
var _ = iotdb._;

var logger = iotdb.logger({
    name: 'homestar-chromecast',
    module: 'ChromecastBridge',
});

var mode_play = "iot-purpose:media.mode.play";
var mode_pause = "iot-purpose:media.mode.pause";
var mode_stop = "iot-purpose:media.mode.stop";

/**
 *  See {iotdb.bridge.Bridge#Bridge} for documentation.
 *  <p>
 *  @param {object|undefined} native
 *  only used for instances, should be 
 */
var ChromecastBridge = function (initd, native) {
    var self = this;

    self.initd = _.defaults(initd,
        iotdb.keystore().get("bridges/ChromecastBridge/initd"), {
            poll: 30
        }
    );
    self.native = native; // the thing that does the work - keep this name

    if (self.native) {
        self.queue = _.queue("ChromecastBridge");
    }
};

ChromecastBridge.prototype = new iotdb.Bridge();

ChromecastBridge.prototype.name = function () {
    return "ChromecastBridge";
};

/* --- lifecycle --- */

/**
 *  See {iotdb.bridge.Bridge#discover} for documentation.
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
            addresses: [native.host, ],
            name: native.friendlyName,
            manufacturer: native.manufacturer,
            uuid: native.uuid,
            modelName: native.modelName,
        });

        device.on('connected', function () {
            self.discovered(new ChromecastBridge(self.initd, device));
        });
        device.connect(function (error) {
            if (error) {
                logger.error({
                    method: "_discover/device.connect(callback)",
                    error: _.error.message(error),
                    cauase: "likely an issue in a low level library, sigh",
                }, "unexpected chromecast error");
            }
        });
    });
    cp.search();
};

/**
 *  See {iotdb.bridge.Bridge#connect} for documentation.
 */
ChromecastBridge.prototype.connect = function (connectd) {
    var self = this;
    if (!self.native) {
        return;
    }

    self._validate_connect(connectd);

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
 *  See {iotdb.bridge.Bridge#disconnect} for documentation.
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
 *  See {iotdb.bridge.Bridge#push} for documentation.
 */
ChromecastBridge.prototype.push = function (pushd, done) {
    var self = this;
    if (!self.native) {
        done(new Error("not connected"));
        return;
    }

    self._validate_push(pushd);

    logger.info({
        method: "push",
        pushd: pushd
    }, "push");
    /*
    self.native.play('http://commondatastorage.googleapis.com/gtv-videos-bucket/big_buck_bunny_1080p.mp4', 60, function(){
        console.log('Playing in your chromecast!')
    });
    return;
    */

    var dcount = 0;
    var _doing = function () {
        dcount++;
    };
    var _done = function () {
        if (--dcount <= 0) {
            done();
        }
    };

    try {
        _doing();

        if (pushd.load !== undefined) {
            _doing();
            self._push_load(pushd.load, _done);
        }

        if (pushd.mute !== undefined) {
            _doing();
            self._push_mute(pushd.mute, _done);
        }

        if (pushd.volume !== undefined) {
            _doing();
            self._push_volume(pushd.volume, _done);
        }

        if (pushd["media.play"]) {
            _doing();
            self._push_mode_play(_done);
        } else if (pushd["media.pause"]) {
            _doing();
            self._push_mode_pause(_done);
        } else if (pushd["media.stop"]) {
            _doing();
            self._push_mode_stop(_done);
        }

        _done();
    } catch (x) {
        dcount = -9999;
        done(new Error("unexpected excption: " + x));
    }
};

ChromecastBridge.prototype._push_load = function (iri, _done) {
    var self = this;

    self.queue.add({
        id: "_push_load",
        run: function (queue, qitem) {
            self.native.play(iri, 60, function (error, data) {
                self.queue.finished(qitem);

                if (error) {
                    logger.error({
                        method: "_push_load/callback",
                        error: _.error.message(error),
                    }, "Chromecast error");
                } else {
                    self.pulled({
                        "load": iri,
                    });
                    self.pull();
                }

            });
        },
        coda: function () {
            _done();
        },
    });
};

ChromecastBridge.prototype._push_volume = function (volume, _done) {
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
        },
        coda: function () {
            _done();
        },
    });
};

ChromecastBridge.prototype._push_mute = function (mute, _done) {
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
        },
        coda: function () {
            _done();
        },
    });
};

ChromecastBridge.prototype._push_mode_play = function (_done) {
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
        },
        coda: function () {
            _done();
        },
    });
};

ChromecastBridge.prototype._push_mode_pause = function (_done) {
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
        },
        coda: function () {
            _done();
        },
    });
};

ChromecastBridge.prototype._push_mode_stop = function (_done) {
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
        },
        coda: function () {
            _done();
        },
    });
};


/**
 *  See {iotdb.bridge.Bridge#pull} for documentation.
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
            self.native.getStatus(function (d) {
                process.nextTick(function () {
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
 *  See {iotdb.bridge.Bridge#meta} for documentation.
 */
ChromecastBridge.prototype.meta = function () {
    var self = this;
    if (!self.native) {
        return;
    }

    return {
        "iot:thing-id": _.id.thing_urn.unique("Chromecast", self.native.config.uuid),
        "schema:name": self.native.config.name || "Chromecast",
        "schema:manufacturer": self.native.config.manufacturer,
        "schema:model": self.native.config.modelName,
    };
};

/**
 *  See {iotdb.bridge.Bridge#reachable} for documentation.
 */
ChromecastBridge.prototype.reachable = function () {
    return this.native !== null;
};

/**
 *  See {iotdb.bridge.Bridge#configure} for documentation.
 */
ChromecastBridge.prototype.configure = function (app) {};

/*
 *  API
 */
exports.Bridge = ChromecastBridge;
