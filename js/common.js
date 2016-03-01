navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
window.URL = window.URL || window.webkitURL || window.mozURL || window.msURL;
window.AudioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext || window.msAudioContext;

var width = 1023;
var height = 256;

var audioContext = null;
var sourceNode = null;
var gainNode = null;

var oct,
	noteString,
    minOcter,
	maxOcter,
	minNoteString,
	maxNoteString,
	pianoCanvas1,
	pianoCanvas2;

var	minNote = 121;
var	maxNote = 33;
var rafID = null;

var PIANOCANVAS1 = null;
var PIANOCANVAS2 = null;
var prevNote = null;
var analyser = null;
var playing = false;
var noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
var prevNote = null;
var octer = ["low", "mid1", "mid2", "hi", "hihi", "hihihi", "hihihihi"];

var YINDetector = null;
var DWDetector = null;
var MPMDetector = null;
var	frequencyContext = null;
var	timeDomainContext = null;
var estimate = null;

var	audioElement = null;
var	frequencyElement = null;
var	timeDomainElement = null;
var	pitchExtentElem = null;
var	pitchElem = null;
var gain_value = 2.5;

function initialize(){

    var gainElm = document.querySelector('input[id="gain_value"]');
    gainElm.addEventListener("change", function() {
      gain_value = document.querySelector('input[name="gain_value"]').value;
    }, false);

	audioContext = new AudioContext();

	audioElement = document.getElementById("audio");
	frequencyElement = document.getElementById("frequency");
	timeDomainElement = document.getElementById("timedomain");
	pitchExtentElem = document.getElementById( "pitch_extent" );
	pitchElem = document.getElementById( "pitch" );

	frequencyContext = frequencyElement.getContext("2d");
	timeDomainContext = timeDomainElement.getContext("2d");

	YINDetector = PitchFinder.YIN({sampleRate : 48000});
	DWDetector = PitchFinder.DW({sampleRate : 48000, bufferSize : 2048});
	MPMDetector = PitchFinder.MPM({sampleRate : 48000, bufferSize : 2048});

	PIANOCANVAS1 = document.getElementById( "piano1" );
	PIANOCANVAS2 = document.getElementById( "piano2" );

	frequencyElement.width = width;
	frequencyElement.height = height;
	timeDomainElement.width = width;
	timeDomainElement.height = height;

	pianoCanvas1 = PIANOCANVAS1.getContext("2d");
	pianoCanvas1.strokeStyle = "black";
	pianoCanvas1.lineWidth = 1;
	pianoCanvas1.beginPath();
	pianoCanvas2 = PIANOCANVAS2.getContext("2d");
	pianoCanvas2.strokeStyle = "black";
	pianoCanvas2.lineWidth = 1;
	pianoCanvas2.beginPath();

	var start = 33;
	for (var i=start ;i< start + 88;i++){
		var noteString = noteStrings[i%12];
		var position = (Math.floor((i - start) /12)) * 7 + noteString.charCodeAt(0) - 65;
		if ( noteString.length == 2){
			pianoCanvas2.beginPath();
			pianoCanvas2.rect(position*18+9, 0, 14, 72);
			pianoCanvas2.fillStyle = 'black';
			pianoCanvas2.fill();
		}
		else{
			pianoCanvas1.moveTo(position*18,     0);
			pianoCanvas1.lineTo(position*18,   128);
			pianoCanvas1.lineTo(position*18+18, 128);
			pianoCanvas1.lineTo(position*18+18,   0);
			pianoCanvas1.stroke();
		}
	}

	userMedia();

}

function noteFromPitch( frequency ) {
	var noteNum = 12 * (Math.log( frequency / 440 )/Math.log(2) );
	return Math.round( noteNum ) + 69;
}

function userMedia(){
	navigator.getUserMedia(
	{
		"audio": {
			"mandatory": {
				"googEchoCancellation": "false",
				"googAutoGainControl": "false",
				"googNoiseSuppression": "false",
				"googHighpassFilter": "false"
			},
		"optional": []
		},
	}, gotStream, error);
}

function error (err){
	console.log(err);
}
function gotStream(stream) {
    // Create an AudioNode from the stream.
    sourceNode = audioContext.createMediaStreamSource(stream);

    // Connect it to the destination.
//    gainNode = audioContext.createGain();
//    gainNode.gain.value = 1.5;

    gainNode = audioContext.createScriptProcessor(256, 2, 2);
    gainNode.onaudioprocess = function(audioProcessingEvent) {
        var input = audioProcessingEvent.inputBuffer;
        var output = audioProcessingEvent.outputBuffer;

        for(var channel = 0; channel < 2; channel++) {
            var I = input.getChannelData(channel);
            var O = output.getChannelData(channel);

            for(var i = 0; i < input.length; i++) {
                O[i] = I[i];
                O[i] *= gain_value;
            }
        }
    }
    sourceNode.connect(gainNode);

    analyser = audioContext.createAnalyser();
    gainNode.connect( analyser );
	analyser.connect( audioContext.destination );
    updatePitch();
}

function updatePitch() {

	var frequencyData = new Uint8Array(analyser.frequencyBinCount);
	var timeDomainData = new Uint8Array(analyser.frequencyBinCount);
	var float32Array = new Float32Array(2048);

	var animation = function(){

		analyser.getByteFrequencyData(frequencyData);
		analyser.getByteTimeDomainData(timeDomainData);
		analyser.getFloatTimeDomainData(float32Array);

		frequencyContext.clearRect(0, 0, width, height);
		frequencyContext.beginPath();
		frequencyContext.moveTo(0, height - frequencyData[0]);
		for (var i = 1, l = frequencyData.length; i < l; i++) {
			frequencyContext.lineTo(i, height - frequencyData[i]);
		}
		frequencyContext.stroke();

		timeDomainContext.clearRect(0, 0, width, height);
		timeDomainContext.beginPath();
		timeDomainContext.moveTo(0, height - timeDomainData[0]);
		for (var i = 1, l = timeDomainData.length; i < l; i++) {
			timeDomainContext.lineTo(i, height - timeDomainData[i]);
		}
		timeDomainContext.stroke();

		var algo = document.querySelector('input[name="algo"]:checked').value;
		if (algo =='YIN'){
			estimate = YINDetector(float32Array);
		}
		if (algo =='DW'){
			estimate = DWDetector(float32Array);
		}
		if (algo == 'MPM'){
			estimate = MPMDetector(float32Array);
		}

		var freq = estimate.freq;

		var note = noteFromPitch(freq);
		console.log(freq);

		if (note>=33 && note <=121) {  // This draws the outputed tones

			if (minNote > note){
				minOcter = Math.floor((note -33) /12);
				minNoteString = noteStrings[note%12];
				minNote = note;
			}
			if (maxNote < note){
				maxOcter = Math.floor((note -33) /12);
				maxNoteString = noteStrings[note%12];
				maxNote = note;
			}
			oct = Math.floor((note -33) /12);
			noteString = noteStrings[note%12];
			pitchExtentElem.innerHTML = octer[minOcter] + minNoteString + " " + octer[maxOcter] + maxNoteString;
			pitchElem.innerHTML = octer[oct] + noteString;

			if (prevNote != null){
				var noteString = noteStrings[prevNote%12];
				var position = (Math.floor((prevNote - 33) /12)) * 7 + noteString.charCodeAt(0) - 65;

				if ( noteString.length == 2){
					pianoCanvas2.beginPath();
					pianoCanvas2.rect(position*18+9, 0, 14, 72);
					pianoCanvas2.fillStyle = 'yellow';
					pianoCanvas2.fill();
					pianoCanvas2.strokeStyle = "black";
					pianoCanvas2.moveTo(position*18+9,     0);
					pianoCanvas2.lineTo(position*18+9,   72);
					pianoCanvas2.lineTo(position*18+9+14,  72);
					pianoCanvas2.lineTo(position*18+9+14,    0);
					pianoCanvas2.stroke();
				}
				else{
					pianoCanvas1.beginPath();
					pianoCanvas1.rect(position*18, 0, 18, 128);
					pianoCanvas1.fillStyle = 'yellow';
					pianoCanvas1.fill();
					pianoCanvas1.strokeStyle = "black";
					pianoCanvas1.moveTo(position*18,     0);
					pianoCanvas1.lineTo(position*18,   128);
					pianoCanvas1.lineTo(position*18+18, 128);
					pianoCanvas1.lineTo(position*18+18,   0);
					pianoCanvas1.stroke();
				}
			}

			var noteString = noteStrings[note%12];
			var position = (Math.floor((note - 33) /12)) * 7 + noteString.charCodeAt(0) - 65;

			if ( noteString.length == 2){
				pianoCanvas2.beginPath();
				pianoCanvas2.rect(position*18+9, 0, 14, 72);
				pianoCanvas2.fillStyle = 'red';
				pianoCanvas2.fill();
				pianoCanvas2.strokeStyle = "black";
				pianoCanvas2.moveTo(position*18+9,     0);
				pianoCanvas2.lineTo(position*18+9,   72);
				pianoCanvas2.lineTo(position*18+9+14,  72);
				pianoCanvas2.lineTo(position*18+9+14,    0);
				pianoCanvas2.stroke();
			}
			else{
				pianoCanvas1.beginPath();
				pianoCanvas1.rect(position*18, 0, 18, 128);
				pianoCanvas1.fillStyle = 'red';
				pianoCanvas1.fill();
				pianoCanvas1.strokeStyle = "black";
				pianoCanvas1.moveTo(position*18,     0);
				pianoCanvas1.lineTo(position*18,   128);
				pianoCanvas1.lineTo(position*18+18, 128);
				pianoCanvas1.lineTo(position*18+18,   0);
				pianoCanvas1.stroke();
			}

			prevNote = note;
		}

		requestAnimationFrame(animation);

	};

	animation();

}
function changeSourceMic(){

	sourceNode.stop(0);
	analyser.disconnect( audioContext.destination);
	sourceNode.disconnect(analyser);
	sourceNode = null;
	analyser = null;

	if (!window.cancelAnimationFrame)
		window.cancelAnimationFrame = window.webkitCancelAnimationFrame;
	window.cancelAnimationFrame( rafID );

	userMedia();
}

function changeSourceOsi(){

	analyser.disconnect( audioContext.destination);
	gainNode.disconnect(analyser);
	sourceNode.disconnect(gainNode);
	sourceNode = null;
	gainNode = null;
	analyser = null;
	if (!window.cancelAnimationFrame)
		window.cancelAnimationFrame = window.webkitCancelAnimationFrame;
	window.cancelAnimationFrame( rafID );

	sourceNode = audioContext.createOscillator();
	analyser = audioContext.createAnalyser();
	sourceNode.connect(analyser);
	sourceNode.start(0);
	analyser.connect( audioContext.destination );
	updatePitch();
}

window.addEventListener("load", initialize, false);
