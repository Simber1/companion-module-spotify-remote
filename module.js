//TODO:
// Clean up code, volume function, shuffle function, play function all in a different file. Startup and config function for setting all of the wrapper vars too
// Varibles: Current Volume, Current song, Song progress, Current album art as a var(?), Current Play Status, Current Device Name
// Fix no active device
// Auto Refresh key; Kinda done, only works on actions
// Instance Feedback for current playback state, shuffle/repeat on or off


var instance_skel = require('../../instance_skel');
var SpotifyWebApi = require('spotify-web-api-node');
const clipboardy = require('clipboardy');

var spotifyApi;
var volumeUpAmount;
var volumeDownAmount;



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

	// super-constructor
	instance_skel.apply(this, arguments);

    self.actions(); // export actions

	return self;
}

function errorCheck(err){
    //Error Code 401 represents out of date token
    if(err.statusCode == '401'){
        spotifyApi.refreshAccessToken().then(
            function(data) {
              spotifyApi.setAccessToken(data.body['access_token']);
            },
            function(err) {
              console.log('Could not refresh access token', err);
            }
        );
    } else{
        console.log('Something went wrong with an API Call: '+ err);
    }

}

function ChangePlayState(action) {
    spotifyApi.getMyCurrentPlaybackState()
    .then(function(data) {
    // Output items
        if (data.body && data.body.is_playing) {
            if(action.action == 'pause' || action.action == 'play/pause'){
                spotifyApi.pause().then(
                    function() {}, 
                    function(err) {console.log('Something went wrong!', err);}
                );
            }
        } else {
            if(action.action == 'play' || action.action == 'play/pause'){
                spotifyApi.play().then(
                    function() {}, 
                    function(err) {console.log('Something went wrong!', err);}
                );
            }
        }
    }, function(err) {
        errorCheck(err);
        ChangePlayState(action);
    });
}

function ChangeShuffleState(action){
    spotifyApi.getMyCurrentPlaybackState()
    .then(function(data) {
        if (data.body && data.body.shuffle_state) {
            if(action.action == 'shuffleOff' || action.action == 'shuffleToggle'){
                spotifyApi.setShuffle(false)
                    .then(function() {}, 
                    function(err) {errorCheck(err)});
            }
        }else{
            if(action.action == 'shuffleOn' || action.action == 'shuffleToggle'){
                spotifyApi.setShuffle(true)
                .then(function() {}, 
                function(err) {errorCheck(err)});
            }
        }
    }, function(err) {
        errorCheck(err);
        ChangeShuffleState(action);
    });

}

function ChangeVolume(action){
    var availableDevices;
    var currentVolume;

    spotifyApi.getMyDevices()
    .then(function(data) {

        availableDevices = data.body.devices;

        for(i=0; i <availableDevices.length; i++){
            if(availableDevices[i].is_active){
                currentVolume = availableDevices[i].volume_percent;
            }
        }

        if(action.action == 'volumeUp')
        {
            currentVolume = currentVolume - -action.options.volumeUpAmount; //double negitive because JS things
            if(currentVolume > 100){ currentVolume = 100; }
        }
        else
        {
            currentVolume = currentVolume - action.options.volumeDownAmount;
            if(currentVolume < 0){ currentVolume = 0; }
        }

        spotifyApi.setVolume(currentVolume)
            .then(function () {}, 
            function(err) {errorCheck(err)});
        }, function(err) {
            errorCheck(err);
            ChangeVolume(action);
        });
}

function SkipSong(){
    spotifyApi.skipToNext()
    .then(function() {}, 
    function(err) {
        errorCheck(err);
        SkipSong();
    });
}

function PreviousSong(){
    spotifyApi.skipToPrevious()
    .then(function() {}, 
    function(err) {
        errorCheck(err);
        PreviousSong();
    });
}

instance.prototype.updateConfig = function(config) {
	var self = this;

    self.config = config;

    spotifyApi.setClientId(self.config.clientId);
    spotifyApi.setClientSecret(self.config.clientSecret);
    spotifyApi.setRedirectURI(self.config.redirectUri);
    if(self.config.code&& !self.config.accessToken){
        spotifyApi.authorizationCodeGrant(self.config.code).then(
            function(data) {
            let toClip = 'The access token is ' + data.body['access_token'] +"\n"+ 'The refresh token is ' + data.body['refresh_token'];
            clipboardy.writeSync(toClip);
        
            // Set the access token on the API object to use it in later calls
            spotifyApi.setAccessToken(data.body['access_token']);
            spotifyApi.setRefreshToken(data.body['refresh_token']);
        }, function(err) {errorCheck(err)});
    }
    if(self.config.redirectUri && self.config.clientSecret && self.config.clientId && !self.config.accessToken && !self.config.code){
        clipboardy.writeSync(spotifyApi.createAuthorizeURL(scopes));
    }
    if(self.config.accessToken){
        spotifyApi.setAccessToken(self.config.accessToken);
    }
    if(self.config.refreshToken){
        spotifyApi.setRefreshToken(self.config.refreshToken);
    }


	self.actions();
}

instance.prototype.init = function() {
	var self = this;

    self.status(self.STATE_OK);
    
    spotifyApi = new SpotifyWebApi();
    if(self.config.clientId){ spotifyApi.setClientId(self.config.clientId)}
    if(self.config.clientSecret){ spotifyApi.setClientSecret(self.config.clientSecret)}
    if(self.config.redirectUri){ spotifyApi.setRedirectURI(self.config.redirectUri)}
    if(self.config.accessToken){
        spotifyApi.setAccessToken(self.config.accessToken);
    }
    if(self.config.refreshToken){
        spotifyApi.setRefreshToken(self.config.refreshToken);
    }

    spotifyApi.refreshAccessToken().then(
        function(data) {
            // Save the access token so that it's used in future calls
            spotifyApi.setAccessToken(data.body['access_token']);
        },
        function(err) {
            console.log('Could not refresh access token', err);
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
			label: 'Code',
        },
        {
			type: 'textinput',
			id: 'accessToken',
			width: 12,
			label: 'accessToken',
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
        'getDevices': {
            label: 'Get Devices'
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
        }
	});
}

instance.prototype.action = function(action) {
    var self = this;

    if(action.action == "play/pause" || action.action == 'play' || action.action == 'pause'){
        ChangePlayState(action);
    }

    if(action.action == 'shuffleToggle' || action.action=='shuffleOn' || action.action=='shuffleOff'){
        ChangeShuffleState(action);
    }

    if(action.action == 'volumeUp' || action.action == 'volumeDown'){
        ChangeVolume(action);
    }

    if(action.action == 'skip'){
        SkipSong();
    }

    if(action.action == 'previous'){
        PreviousSong();
    }
}   
instance_skel.extendedBy(instance);
exports = module.exports = instance;
