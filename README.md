# homestar-chromecast
[IOTDB](https://github.com/dpjanes/node-iotdb) Bridge for [Google ChromeCast](https://www.google.com/intl/en_ca/chromecast/?utm_source=chromecast.com)
This allows you to control your ChromeCast devices from IOTDB.

<img src="https://raw.githubusercontent.com/dpjanes/iotdb-homestar/master/docs/HomeStar.png" align="right" />


# Installation

[Install Home☆Star first](https://homestar.io/about/install).

Then:

    $ homestar install homestar-chromecast

# Testing
## Home☆Star

Do:

	$ homestar runner browser=1
	
You may have to refresh the page, as it may take a little while for your Things to be discovered.

## IOTDB

Play a video on your ChromeCast

	$ node
	>>> iotdb = require('iotdb')
	>>> things = iotdb.connect("Chromecast")
	>>> things.set(":media.load", "http://commondatastorage.googleapis.com/gtv-videos-bucket/big_buck_bunny_1080p.mp4")
	
## [IoTQL](https://github.com/dpjanes/iotdb-iotql)

Play a video on your ChromeCast

	$ homestar install iotql
	$ homestar iotql
	> SET state:media.load = "http://commondatastorage.googleapis.com/gtv-videos-bucket/big_buck_bunny_1080p.mp4" WHERE meta:model-id = "chromecast";
	

# Models
## Chromecast

See [Chromecast.iotql](https://github.com/dpjanes/homestar-chromecast/blob/master/models/Chromecast.iotql)
