# homestar-chromecast
[IOTDB](https://github.com/dpjanes/node-iotdb) Bridge for [Google ChromeCast](https://www.google.com/intl/en_ca/chromecast/?utm_source=chromecast.com)

<img src="https://raw.githubusercontent.com/dpjanes/iotdb-homestar/master/docs/HomeStar.png" align="right" />

# About

This allows you to control your ChromeCast devices from IOTDB.

* [Read about Bridges](https://github.com/dpjanes/node-iotdb/blob/master/docs/bridges.md)

# Installation

* [Read this first](https://github.com/dpjanes/node-iotdb/blob/master/docs/install.md)

Then:

    $ npm install homestar-chromecast

# Use

Play a video on your ChromeCast

	const iotdb = require('iotdb')
    iotdb.use("homestar-chromecast")

	const things = iotdb.connect("Chromecast")
	things.set(":media.load", "http://commondatastorage.googleapis.com/gtv-videos-bucket/big_buck_bunny_1080p.mp4")
	
# Models
## Chromecast

See [Chromecast.iotql](https://github.com/dpjanes/homestar-chromecast/blob/master/models/Chromecast.iotql)
