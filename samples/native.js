/*
 *  This is just using the Chromecast library directly
 */
const chromecastjs = require('chromecast-js');
const browser = new chromecastjs.Browser();

browser.on('deviceOn', function (device) {
    device.connect();
    device.on('connected', function () {

        device.play('http://commondatastorage.googleapis.com/gtv-videos-bucket/big_buck_bunny_1080p.mp4', 60, function () {
            console.log('Playing in your chromecast!');
        });

        setTimeout(function () {
            device.pause(function () {
                console.log('Paused!');
            });
        }, 30000);

        setTimeout(function () {
            device.stop(function () {
                console.log('Stoped!');
            });
        }, 40000);

    });

});
