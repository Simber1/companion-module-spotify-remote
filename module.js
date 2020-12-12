//TODO:
// Clean up code, volume function, shuffle function, play function all in a different file. Startup and config function for setting all of the wrapper vars too
// Varibles: Current Volume, Current song, Song progress, Current album art as a var(?), Current Play Status, Current Device Name
// Auto Refresh key; Done, seems to be working.
// Instance Feedback for current playback state, shuffle/repeat on or off


var instance_skel = require('../../instance_skel');
var SpotifyWebApi = require('spotify-web-api-node');
const clipboardy  = require('clipboardy');

const scopes = [
    'ugc-image-upload',
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'streaming',
    'app-remote-control',
    'user-read-email',
    'user-read-private',
    'playlist-read-collaborative',
    'playlist-modify-public',
    'playlist-read-private',
    'playlist-modify-private',
    'user-library-modify',
    'user-library-read',
    'user-top-read',
    'user-read-playback-position',
    'user-read-recently-played',
    'user-follow-read',
    'user-follow-modify'
];


function instance(system, id, config) {
	var self = this;
    self.spotifyApi = null;
	// super-constructor
	instance_skel.apply(this, arguments);

    self.actions(); // export actions

	return self;
}

function errorCheck(err,self){
    //Error Code 401 represents out of date token
    if (err.statusCode == '401') {
        self.spotifyApi.refreshAccessToken().then(
            function(data) {
              self.spotifyApi.setAccessToken(data.body['access_token']);
            },
            function(err) {
                self.warn('Could not refresh access token', err);
            }
        );
    }
    else {
        self.warn('Something went wrong with an API Call: '+ err);
    }
}

function ChangePlayState(action,device,self) {
    self.spotifyApi.getMyCurrentPlaybackState()
    .then(function(data) {
    // Output items
        if (data.body && data.body.is_playing) {
            if (action.action == 'pause' || action.action == 'play/pause') {
                self.spotifyApi.pause().then(
                    function() {},
                    function(err) {self.warn('Something went wrong!', err);}
                );
            }
        } else {
            if (action.action == 'play' || action.action == 'play/pause'){
                self.spotifyApi.play({"device_id": device}).then(
                    function() {},
                    function(err) {self.warn('Something went wrong!', err);}
                );
            }
        }
    }, function(err) {
        if (errorCheck(err,self)) {
            ChangePlayState(action,self);
        }
    });
}

function ChangeShuffleState(action,self) {
    self.spotifyApi.getMyCurrentPlaybackState()
    .then(function(data) {
        if (data.body && data.body.shuffle_state) {
            if (action.action == 'shuffleOff' || action.action == 'shuffleToggle') {
                self.spotifyApi.setShuffle(false)
                    .then(function() {},
                    function(err) {errorCheck(err,self)});
            }
        }else{
            if (action.action == 'shuffleOn' || action.action == 'shuffleToggle') {
                self.spotifyApi.setShuffle(true)
                .then(function() {},
                function(err) {errorCheck(err,self)});
            }
        }
    }, function(err,) {
        if (errorCheck(err,self)) {
            ChangeShuffleState(action,self);
        }
    });

}

function ChangeVolume(action,device,self) {
    var availableDevices;
    var currentVolume;

    self.spotifyApi.getMyDevices()
    .then(function(data) {

        availableDevices = data.body.devices;

        for (i=0; i <availableDevices.length; i++) {
            if (availableDevices[i].id == device) {
                currentVolume = availableDevices[i].volume_percent;
            }
        }

        if (action.action == 'volumeUp') {
            currentVolume = currentVolume - -action.options.volumeUpAmount; //double negitive because JS things
            if (currentVolume > 100) {
                currentVolume = 100;
            }
        }
        else {
            currentVolume = currentVolume - action.options.volumeDownAmount;
            if (currentVolume < 0) {
                currentVolume = 0;
            }
        }

        self.spotifyApi.setVolume(currentVolume,{"device_id": device})
            .then(function () {},
            function(err) {
                errorCheck(err,self)
            });
        }, function(err) {
            if (errorCheck(err,self)) {
                ChangeVolume(action,self);
            }
        });
}

function SkipSong(self) {
    self.spotifyApi.skipToNext()
    .then(function() {},
    function(err) {
        if (errorCheck(err,self)) {
            SkipSong(self);
        }
    });
}

function PreviousSong(self){
    self.spotifyApi.skipToPrevious()
    .then(function() {},
    function(err) {
        if (errorCheck(err,self)) {
            PreviousSong(self);
        }
    });
}

instance.prototype.updateConfig = function(config) {
	var self = this;

    self.config = config;
    self.spotifyApi.setClientId(self.config.clientId);
    self.spotifyApi.setClientSecret(self.config.clientSecret);
    self.spotifyApi.setRedirectURI(self.config.redirectUri);
    if (self.config.code&& !self.config.accessToken) {
        self.spotifyApi.authorizationCodeGrant(self.config.code).then(
            function(data) {
            let toClip = 'The access token is ' + data.body['access_token'] +"\n"+ 'The refresh token is ' + data.body['refresh_token'];
            clipboardy.writeSync(toClip);

            // Set the access token on the API object to use it in later calls
            self.self.spotifyApi.setAccessToken(data.body['access_token']);
            self.spotifyApi.setRefreshToken(data.body['refresh_token']);
        }, function(err) {errorCheck(err)});
    }
    if (self.config.redirectUri && self.config.clientSecret && self.config.clientId && !self.config.accessToken && !self.config.code) {
        clipboardy.writeSync(self.spotifyApi.createAuthorizeURL(scopes));
    }
    if (self.config.accessToken) {
        self.spotifyApi.setAccessToken(self.config.accessToken);
    }
    if (self.config.refreshToken) {
        self.spotifyApi.setRefreshToken(self.config.refreshToken);
    }

	self.actions();
}

instance.prototype.init = function() {
	var self = this;
    
    self.status(self.STATE_OK);

    let spotifyApi = new SpotifyWebApi();
    self.spotifyApi = spotifyApi;
    if (self.config.clientId) {
        self.spotifyApi.setClientId(self.config.clientId)
    }
    if (self.config.clientSecret) {
        self.spotifyApi.setClientSecret(self.config.clientSecret)
    }
    if (self.config.redirectUri) {
        self.spotifyApi.setRedirectURI(self.config.redirectUri)
    }
    if (self.config.accessToken) {
        self.spotifyApi.setAccessToken(self.config.accessToken);
    }
    if (self.config.refreshToken) {
        self.spotifyApi.setRefreshToken(self.config.refreshToken);
    }

    self.spotifyApi.refreshAccessToken().then(
        function(data) {
            // Save the access token so that it's used in future calls
            self.spotifyApi.setAccessToken(data.body['access_token']);
        },
        function(err) {
            self.warn('Could not refresh access token', err);
        }
    );

	debug = self.debug;
	log = self.log;
}

instance.prototype.destroy = function() {
    var self = this;
    debug("destroy");
    //TODO
}

instance.prototype.config_fields = function () {
    var self = this;
	return [
        {
			type: 'text',
			id: 'info',
			width: 12,
			label: 'Setup Information',
			value: '<strong>PLEASE READ THIS!</strong> How to setup goes in here'
		},
		{
			type: 'textinput',
			id: 'clientId',
			width: 12,
			label: 'Client ID',
		},
		{
			type: 'textinput',
			id: 'clientSecret',
			width: 12,
			label: 'Client Secret',
        },
        {
			type: 'textinput',
			id: 'redirectUri',
			width: 12,
			label: 'Redirect URL',
        },
        {
			type: 'textinput',
			id: 'code',
			width: 12,
			label: 'Approval Code',
        },
        {
			type: 'textinput',
			id: 'accessToken',
			width: 12,
			label: 'Access Token',
        },
        {
            type: 'textinput',
            id: 'refreshToken',
            width: 12,
            label: 'Refresh Token'
        },
        {
            type: 'textinput',
            id: 'deviceId',
            width: 12,
            label: 'Device ID'
        }
	]
}



instance.prototype.actions = function(system) {
	var self = this;

	self.setActions({
		'play/pause': {
			label: 'Toggle Play/Pause',
        },
        'play': {
			label: 'Play',
        },
        'pause': {
			label: 'Pause Playback',
        },
        'volumeUp': {
            label: 'Volume Up',
			options: [
				{
					type: 'textinput',
					label: "Volume",
					id: 'volumeUpAmount',
					default: '5'
				}
			]
        },
        'volumeDown': {
            label: 'Volume Down',
			options: [
				{
					type: 'textinput',
					label: "Volume",
					id: 'volumeDownAmount',
					default: '5'
				}
			]
        },
        'skip': {
            label: 'Skip Track'
        },
        'previous': {
            label: 'Previous Track'
        },
        'shuffleToggle': {
            label: "Toggle Shuffle"
        },
        'shuffleOn': {
            label: "Turn Shuffle On"
        },
        'shuffleOff': {
            label: "Turn Shuffle Off"
        },
        'activeDeviceToClip': {
            label: "Copy the ID of the current Active Device"
        }
	});
}

instance.prototype.action = function(action) {
    var self = this;

    if (action.action == "play/pause" || action.action == 'play' || action.action == 'pause') {
        ChangePlayState(action,self.config.deviceId,self);
    }

    if (action.action == 'shuffleToggle' || action.action=='shuffleOn' || action.action=='shuffleOff') {
        ChangeShuffleState(action,self);
    }

    if (action.action == 'volumeUp' || action.action == 'volumeDown') {
        ChangeVolume(action,self.config.deviceId,self);
    }

    if (action.action == 'skip') {
        SkipSong(self);
    }

    if (action.action == 'previous') {
        PreviousSong(self);
    }

    if (action.action == 'activeDeviceToClip') {
        self.spotifyApi.getMyDevices()
        .then(function(data) {
            let availableDevices = data.body.devices;
            for (var i=0; i < availableDevices.length; i++) {
                if (availableDevices[i].is_active) {
                    clipboardy.writeSync(availableDevices[i].id);
                }
            }
        }, function(err) {
            self.warn('Something went wrong!', err);
        });
    }
}
instance_skel.extendedBy(instance);
exports = module.exports = instance;
