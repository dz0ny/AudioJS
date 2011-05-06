/*
AudioJS - HTML5 Audio Player
v2.0.2

This file is part of VideoJS. Copyright 2010 Zencoder, Inc.
-Modified for html5 audio tag by dz0ny
-Updated to newer VideoJS version (2.0.2) by dodo

Based on VideoJS 6824c1f1d8bcc3f5b45c

AudioJS is free software: you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

AudioJS is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License
along with AudioJS.  If not, see <http://www.gnu.org/licenses/>.
*/

// Self-executing function to prevent global vars and help with minification
(function(window, undefined){
  var document = window.document;

// Using jresig's Class implementation http://ejohn.org/blog/simple-javascript-inheritance/
(function(){var initializing=false, fnTest=/xyz/.test(function(){xyz;}) ? /\b_super\b/ : /.*/; this.JRClass = function(){}; JRClass.extend = function(prop) { var _super = this.prototype; initializing = true; var prototype = new this(); initializing = false; for (var name in prop) { prototype[name] = typeof prop[name] == "function" && typeof _super[name] == "function" && fnTest.test(prop[name]) ? (function(name, fn){ return function() { var tmp = this._super; this._super = _super[name]; var ret = fn.apply(this, arguments); this._super = tmp; return ret; }; })(name, prop[name]) : prop[name]; } function JRClass() { if ( !initializing && this.init ) this.init.apply(this, arguments); } JRClass.prototype = prototype; JRClass.constructor = JRClass; JRClass.extend = arguments.callee; return JRClass;};})();

// Audio JS Player Class
var AudioJS = JRClass.extend({

  // Initialize the player for the supplied audio tag element
  // element: audio tag
  init: function(element, setOptions){

    // Allow an ID string or an element
    if (typeof element == 'string') {
      this.audio = document.getElementById(element);
    } else {
      this.audio = element;
    }
    // Store reference to player on the audio element.
    // So you can acess the player later: document.getElementById("audio_id").player.play();
    this.audio.player = this;
    this.values = {}; // Cache audio values.
    this.elements = {}; // Store refs to controls elements.

    // Default Options
    this.options = {
      autoplay: false,
      preload: true,
      useBuiltInControls: false, // Use the browser's controls (iPhone)
      controlsBelow: true, // Display control bar below audio vs. in front of
      controlsAtStart: true, // Make controls visible when page loads
      controlsHiding: false, // Hide controls when not over the audio
      defaultVolume: 0.85, // Will be overridden by localStorage volume if available
      playerFallbackOrder: ["html5", "links"], // Players and order to use them
    };
    // Override default options with global options
    if (typeof AudioJS.options == "object") { _V_.merge(this.options, AudioJS.options); }
    // Override default & global options with options specific to this player
    if (typeof setOptions == "object") { _V_.merge(this.options, setOptions); }
    // Override preload & autoplay with audio attributes
    if (this.getPreloadAttribute() !== undefined) { this.options.preload = this.getPreloadAttribute(); }
    if (this.getAutoplayAttribute() !== undefined) { this.options.autoplay = this.getAutoplayAttribute(); }

    // Store reference to embed code pieces
    this.box = this.audio.parentNode;
    this.linksFallback = this.getLinksFallback();
    this.hideLinksFallback(); // Will be shown again if "links" player is used

    // Loop through the player names list in options, "html5" etc.
    // For each player name, initialize the player with that name under AudioJS.players
    // If the player successfully initializes, we're done
    // If not, try the next player in the list
    this.each(this.options.playerFallbackOrder, function(playerType){
      if (this[playerType+"Supported"]()) { // Check if player type is supported
        this[playerType+"Init"](); // Initialize player type
        return true; // Stop looping though players
      }
    });

    // Start Global Listeners - API doesn't exist before now
    this.activateElement(this, "player");
    this.activateElement(this.box, "box");
  },
  /* Behaviors
  ================================================================================ */
  behaviors: {},
  newBehavior: function(name, activate, functions){
    this.behaviors[name] = activate;
    this.extend(functions);
  },
  activateElement: function(element, behavior){
    // Allow passing and ID string
    if (typeof element == "string") { element = document.getElementById(element); }
    this.behaviors[behavior].call(this, element);
  },
  /* Errors/Warnings
  ================================================================================ */
  errors: [], // Array to track errors
  warnings: [],
  warning: function(warning){
    this.warnings.push(warning);
    this.log(warning);
  },
  /* History of errors/events (not quite there yet)
  ================================================================================ */
  history: [],
  log: function(event){
    if (!event) { return; }
    if (typeof event == "string") { event = { type: event }; }
    if (event.type) { this.history.push(event.type); }
    if (this.history.length >= 50) { this.history.shift(); }
    try { console.log(event.type); } catch(e) { try { opera.postError(event.type); } catch(e){} }
  },
  /* Local Storage
  ================================================================================ */
  setLocalStorage: function(key, value){
    if (!localStorage) { return; }
    try {
      localStorage[key] = value;
    } catch(e) {
      if (e.code == 22 || e.code == 1014) { // Webkit == 22 / Firefox == 1014
        this.warning(AudioJS.warnings.localStorageFull);
      }
    }
  },
  /* Helpers
  ================================================================================ */
  getPreloadAttribute: function(){
    if (typeof this.audio.hasAttribute == "function" && this.audio.hasAttribute("preload")) {
      var preload = this.audio.getAttribute("preload");
      // Only included the attribute, thinking it was boolean
      if (preload === "" || preload === "true") { return "auto"; }
      if (preload === "false") { return "none"; }
      return preload;
    }
  },
  getAutoplayAttribute: function(){
    if (typeof this.audio.hasAttribute == "function" && this.audio.hasAttribute("autoplay")) {
      var autoplay = this.audio.getAttribute("autoplay");
      if (autoplay === "false") { return false; }
      return true;
    }
  },
  // Calculates amoutn of buffer is full
  bufferedPercent: function(){ return (this.duration()) ? this.buffered()[1] / this.duration() : 0; },
  // Each that maintains player as context
  // Break if true is returned
  each: function(arr, fn){
    if (!arr || arr.length === 0) { return; }
    for (var i=0,j=arr.length; i<j; i++) {
      if (fn.call(this, arr[i], i)) { break; }
    }
  },
  extend: function(obj){
    for (var attrname in obj) {
      if (obj.hasOwnProperty(attrname)) { this[attrname]=obj[attrname]; }
    }
  }
});
AudioJS.player = AudioJS.prototype;

////////////////////////////////////////////////////////////////////////////////
// Player Types
////////////////////////////////////////////////////////////////////////////////

/* Download Links Fallback (Player Type)
================================================================================ */
AudioJS.player.extend({
  linksSupported: function(){ return true; },
  linksInit: function(){
    this.showLinksFallback();
    this.element = this.audio;
  },
  // Get the download links block element
  getLinksFallback: function(){ return this.box.getElementsByTagName("P")[0]; },
  // Hide no-audio download paragraph
  hideLinksFallback: function(){
    if (this.linksFallback) { this.linksFallback.style.display = "none"; }
  },
  // Hide no-audio download paragraph
  showLinksFallback: function(){
    if (this.linksFallback) { this.linksFallback.style.display = "block"; }
  }
});

////////////////////////////////////////////////////////////////////////////////
// Class Methods
// Functions that don't apply to individual audios.
////////////////////////////////////////////////////////////////////////////////

// Combine Objects - Use "safe" to protect from overwriting existing items
AudioJS.merge = function(obj1, obj2, safe){
  for (var attrname in obj2){
    if (obj2.hasOwnProperty(attrname) && (!safe || !obj1.hasOwnProperty(attrname))) { obj1[attrname]=obj2[attrname]; }
  }
  return obj1;
};
AudioJS.extend = function(obj){ this.merge(this, obj, true); };

AudioJS.extend({
  // Add AudioJS to all audio tags with the audio-js class when the DOM is ready
  setupAllWhenReady: function(options){
    // Options is stored globally, and added ot any new player on init
    AudioJS.options = options;
    AudioJS.DOMReady(AudioJS.setup);
  },

  // Run the supplied function when the DOM is ready
  DOMReady: function(fn){
    AudioJS.addToDOMReady(fn);
  },

  // Set up a specific audio or array of audio elements
  // "audio" can be:
  //    false, undefined, or "All": set up all audios with the audio-js class
  //    A audio tag ID or audio tag element: set up one audio and return one player
  //    An array of audio tag elements/IDs: set up each and return an array of players
  setup: function(audios, options){
    var returnSingular = false,
    playerList = [],
    audioElement;

    // If audios is undefined or "All", set up all audios with the audio-js class
    if (!audios || audios == "All") {
      audios = AudioJS.getAudioJSTags();
    // If audios is not an array, add to an array
    } else if (typeof audios != 'object' || audios.nodeType == 1) {
      audios = [audios];
      returnSingular = true;
    }

    // Loop through audios and create players for them
    for (var i=0; i<audios.length; i++) {
      if (typeof audios[i] == 'string') {
        audioElement = document.getElementById(audios[i]);
      } else { // assume DOM object
        audioElement = audios[i];
      }
      playerList.push(new AudioJS(audioElement, options));
    }

    // Return one or all depending on what was passed in
    return (returnSingular) ? playerList[0] : playerList;
  },

  // Find audio tags with the audio-js class
  getAudioJSTags: function() {
    var audioTags = document.getElementsByTagName("audio"),
    audioJSTags = [], audioTag;

    for (var i=0,j=audioTags.length; i<j; i++) {
      audioTag = audioTags[i];
      if (audioTag.className.indexOf("audio-js") != -1) {
        audioJSTags.push(audioTag);
      }
    }
    return audioJSTags;
  },

  // Check if the browser supports audio.
  browserSupportsAudio: function() {
    if (typeof AudioJS.audioSupport != "undefined") { return AudioJS.audioSupport; }
    AudioJS.audioSupport = !!document.createElement('audio').canPlayType;
    return AudioJS.audioSupport;
  },


  // Browser & Device Checks
  isIE: function(){ return !+"\v1"; },
  isIPad: function(){ return navigator.userAgent.match(/iPad/i) !== null; },
  isIPhone: function(){ return navigator.userAgent.match(/iPhone/i) !== null; },
  isIOS: function(){ return AudioJS.isIPhone() || AudioJS.isIPad(); },
  iOSVersion: function() {
    var match = navigator.userAgent.match(/OS (\d+)_/i);
    if (match && match[1]) { return match[1]; }
  },
  isAndroid: function(){ return navigator.userAgent.match(/Android/i) !== null; },
  androidVersion: function() {
    var match = navigator.userAgent.match(/Android (\d+)\./i);
    if (match && match[1]) { return match[1]; }
  },

  warnings: {
    // Safari errors if you call functions on a audio that hasn't loaded yet
    audioNotReady: "Audio is not ready yet (try playing the audio first).",
    // Getting a QUOTA_EXCEEDED_ERR when setting local storage occasionally
    localStorageFull: "Local Storage is Full"
  }
});

// Shim to make audio tag valid in IE
if(AudioJS.isIE()) { document.createElement("audio"); }

// Expose to global
window.AudioJS = window._V_ = AudioJS;

/* HTML5 Player Type
================================================================================ */
AudioJS.player.extend({
  html5Supported: function(){
    if (AudioJS.browserSupportsAudio()) {
      return true;
    } else {
      return false;
    }
  },
  html5Init: function(){
    this.element = this.audio;

    this.fixPreloading(); // Support old browsers that used autobuffer
    this.supportProgressEvents(); // Support browsers that don't use 'buffered'

    // Set to stored volume OR 85%
    this.volume((localStorage && localStorage.volume) || this.options.defaultVolume);

    // Update interface for device needs
    if (AudioJS.isIOS()) {
      this.options.useBuiltInControls = true;
      this.iOSInterface();
    } else if (AudioJS.isAndroid()) {
      this.options.useBuiltInControls = true;
      this.androidInterface();
    }

    // Add AudioJS Controls
    if (!this.options.useBuiltInControls) {
      this.audio.controls = false;

      if (this.options.controlsBelow) { _V_.addClass(this.box, "ajs-controls-below"); }

      // Make a click on th audio act as a play button
      this.activateElement(this.audio, "playToggle");

      // Build Interface
      this.buildStylesCheckDiv(); // Used to check if style are loaded
      this.buildAndActivateSpinner();
      this.buildAndActivateControlBar();
      this.loadInterface(); // Show everything once styles are loaded
      this.getSubtitles();
    }
  },
  /* Source Managemet
  ================================================================================ */
  canPlaySource: function(){
    // Cache Result
    if (this.canPlaySourceResult) { return this.canPlaySourceResult; }
    // Loop through sources and check if any can play
    var children = this.audio.children;
    for (var i=0,j=children.length; i<j; i++) {
      if (children[i].tagName.toUpperCase() == "SOURCE") {
        var canPlay = this.audio.canPlayType(children[i].type) || this.canPlayExt(children[i].src);
        if (canPlay == "probably" || canPlay == "maybe") {
          this.firstPlayableSource = children[i];
          this.canPlaySourceResult = true;
          return true;
        }
      }
    }
    this.canPlaySourceResult = false;
    return false;
  },
  // Check if the extention is compatible, for when type won't work
  canPlayExt: function(src){
    if (!src) { return ""; }
    var match = src.match(/\.([^\.]+)$/);
    if (match && match[1]) {
      var ext = match[1].toLowerCase();
      // Android canPlayType doesn't work
      if (AudioJS.isAndroid()) {
        if (ext == "mp4" || ext == "m4v") { return "maybe"; }
      // Allow Apple HTTP Streaming for iOS
      } else if (AudioJS.isIOS()) {
        if (ext == "m3u8") { return "maybe"; }
      }
    }
    return "";
  },
  // Force the audio source - Helps fix loading bugs in a handful of devices
  // And iPad/iPhone javascript include location bug. And Android type attribute bug
  forceTheSource: function(){
    this.audio.src = this.firstPlayableSource.src; // From canPlaySource()
    this.audio.load();
  },
  /* Device Fixes
  ================================================================================ */
  // Support older browsers that used "autobuffer"
  fixPreloading: function(){
    if (typeof this.audio.hasAttribute == "function" && this.audio.hasAttribute("preload") && this.audio.preload != "none") {
      this.audio.autobuffer = true; // Was a boolean
    } else {
      this.audio.autobuffer = false;
      this.audio.preload = "none";
    }
  },

  // Listen for audio Load Progress (currently does not if html file is local)
  // Buffered does't work in all browsers, so watching progress as well
  supportProgressEvents: function(e){
    _V_.addListener(this.audio, 'progress', this.playerOnAudioProgress.context(this));
  },
  playerOnAudioProgress: function(event){
    this.setBufferedFromProgress(event);
  },
  setBufferedFromProgress: function(event){ // HTML5 Only
    if(event.total > 0) {
      var newBufferEnd = (event.loaded / event.total) * this.duration();
      if (newBufferEnd > this.values.bufferEnd) { this.values.bufferEnd = newBufferEnd; }
    }
  },

  iOSInterface: function(){
    if(AudioJS.iOSVersion() < 4) { this.forceTheSource(); } // Fix loading issues
    if(AudioJS.isIPad()) { // iPad could work with controlsBelow
      this.buildAndActivateSpinner(); // Spinner still works well on iPad, since iPad doesn't have one
    }
  },

  // Fix android specific quirks
  // Use built-in controls, but add the big play button, since android doesn't have one.
  androidInterface: function(){
    this.forceTheSource(); // Fix loading issues
    _V_.addListener(this.audio, "click", function(){ this.play(); }); // Required to play
    this.positionBox();
  },
  /* Wait for styles (TODO: move to _V_)
  ================================================================================ */
  loadInterface: function(){
    if(!this.stylesHaveLoaded()) {
      // Don't want to create an endless loop either.
      if (!this.positionRetries) { this.positionRetries = 1; }
      if (this.positionRetries++ < 100) {
        setTimeout(this.loadInterface.context(this),10);
        return;
      }
    }
    this.hideStylesCheckDiv();
    if (this.options.controlsAtStart) { this.showControlBars(); }
    this.positionAll();
  },
  /* Control Bar
  ================================================================================ */
  buildAndActivateControlBar: function(){
    /* Creating this HTML
      <div class="ajs-controls">
        <div class="ajs-play-control">
          <span></span>
        </div>
        <div class="ajs-progress-control">
          <div class="ajs-progress-holder">
            <div class="ajs-load-progress"></div>
            <div class="ajs-play-progress"></div>
          </div>
        </div>
        <div class="ajs-time-control">
          <span class="ajs-current-time-display">00:00</span><span> / </span><span class="ajs-duration-display">00:00</span>
        </div>
        <div class="ajs-volume-control">
          <div>
            <span></span><span></span><span></span><span></span><span></span><span></span>
          </div>
        </div>
      </div>
    */

    // Create a div to hold the different controls
    this.controls = _V_.createElement("div", { className: "ajs-controls" });
    // Add the controls to the audio's container
    this.box.appendChild(this.controls);
    this.activateElement(this.controls, "controlBar");
    this.activateElement(this.controls, "mouseOverAudioReporter");

    // Build the play control
    this.playControl = _V_.createElement("div", { className: "ajs-play-control", innerHTML: "<span></span>" });
    this.controls.appendChild(this.playControl);
    this.activateElement(this.playControl, "playToggle");

    // Build the progress control
    this.progressControl = _V_.createElement("div", { className: "ajs-progress-control" });
    this.controls.appendChild(this.progressControl);

    // Create a holder for the progress bars
    this.progressHolder = _V_.createElement("div", { className: "ajs-progress-holder" });
    this.progressControl.appendChild(this.progressHolder);
    this.activateElement(this.progressHolder, "currentTimeScrubber");

    // Create the loading progress display
    this.loadProgressBar = _V_.createElement("div", { className: "ajs-load-progress" });
    this.progressHolder.appendChild(this.loadProgressBar);
    this.activateElement(this.loadProgressBar, "loadProgressBar");

    // Create the playing progress display
    this.playProgressBar = _V_.createElement("div", { className: "ajs-play-progress" });
    this.progressHolder.appendChild(this.playProgressBar);
    this.activateElement(this.playProgressBar, "playProgressBar");

    // Create the progress time display (00:00 / 00:00)
    this.timeControl = _V_.createElement("div", { className: "ajs-time-control" });
    this.controls.appendChild(this.timeControl);

    // Create the current play time display
    this.currentTimeDisplay = _V_.createElement("span", { className: "ajs-current-time-display", innerHTML: "00:00" });
    this.timeControl.appendChild(this.currentTimeDisplay);
    this.activateElement(this.currentTimeDisplay, "currentTimeDisplay");

    // Add time separator
    this.timeSeparator = _V_.createElement("span", { innerHTML: " / " });
    this.timeControl.appendChild(this.timeSeparator);

    // Create the total duration display
    this.durationDisplay = _V_.createElement("span", { className: "ajs-duration-display", innerHTML: "00:00" });
    this.timeControl.appendChild(this.durationDisplay);
    this.activateElement(this.durationDisplay, "durationDisplay");

    // Create the volumne control
    this.volumeControl = _V_.createElement("div", {
      className: "ajs-volume-control",
      innerHTML: "<div><span></span><span></span><span></span><span></span><span></span><span></span></div>"
    });
    this.controls.appendChild(this.volumeControl);
    this.activateElement(this.volumeControl, "volumeScrubber");

    this.volumeDisplay = this.volumeControl.children[0];
    this.activateElement(this.volumeDisplay, "volumeDisplay");
  },
  /* Spinner (Loading)
  ================================================================================ */
  buildAndActivateSpinner: function(){
    this.spinner = _V_.createElement("div", {
      className: "ajs-spinner",
      innerHTML: "<div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div>"
    });
    this.box.appendChild(this.spinner);
    this.activateElement(this.spinner, "spinner");
  },
  /* Styles Check - Check if styles are loaded (move ot _V_)
  ================================================================================ */
  // Sometimes the CSS styles haven't been applied to the controls yet
  // when we're trying to calculate the height and position them correctly.
  // This causes a flicker where the controls are out of place.
  buildStylesCheckDiv: function(){
    this.stylesCheckDiv = _V_.createElement("div", { className: "ajs-styles-check" });
    this.stylesCheckDiv.style.position = "absolute";
    this.box.appendChild(this.stylesCheckDiv);
  },
  hideStylesCheckDiv: function(){ this.stylesCheckDiv.style.display = "none"; },
  stylesHaveLoaded: function(){
    if (this.stylesCheckDiv.offsetHeight != 5) {
       return false;
    } else {
      return true;
    }
  },
  /* AudioJS Box - Holds all elements
  ================================================================================ */
  positionAll: function(){
    this.positionBox();
    this.positionControlBars();
  },
  positionBox: function(){
    this.box.style.width = this.width() + "px";
    this.element.style.height=this.height()+"px";
    if (this.options.controlsBelow) {
      this.element.style.height = "";
      // this.box.style.height = this.audio.offsetHeight + this.controls.offsetHeight + "px";
    }
  },
  /* Subtitles
  ================================================================================ */
  getSubtitles: function(){
    var tracks = this.audio.getElementsByTagName("TRACK");
    for (var i=0,j=tracks.length; i<j; i++) {
      if (tracks[i].getAttribute("kind") == "subtitles" && tracks[i].getAttribute("src")) {
        this.subtitlesSource = tracks[i].getAttribute("src");
        this.loadSubtitles();
        this.buildSubtitles();
      }
    }
  },
  loadSubtitles: function() { _V_.get(this.subtitlesSource, this.parseSubtitles.context(this)); },
  parseSubtitles: function(subText) {
    var lines = subText.split("\n"),
        line = "",
        subtitle, time, text;
    this.subtitles = [];
    this.currentSubtitle = false;
    this.lastSubtitleIndex = 0;

    for (var i=0; i<lines.length; i++) {
      line = _V_.trim(lines[i]); // Trim whitespace and linebreaks
      if (line) { // Loop until a line with content

        // First line - Number
        subtitle = {
          id: line, // Subtitle Number
          index: this.subtitles.length // Position in Array
        };

        // Second line - Time
        line = _V_.trim(lines[++i]);
        time = line.split(" --> ");
        subtitle.start = this.parseSubtitleTime(time[0]);
        subtitle.end = this.parseSubtitleTime(time[1]);

        // Additional lines - Subtitle Text
        text = [];
        for (var j=i; j<lines.length; j++) { // Loop until a blank line or end of lines
          line = _V_.trim(lines[++i]);
          if (!line) { break; }
          text.push(line);
        }
        subtitle.text = text.join('<br/>');

        // Add this subtitle
        this.subtitles.push(subtitle);
      }
    }
  },

  parseSubtitleTime: function(timeText) {
    var parts = timeText.split(':'),
        time = 0;
    // hours => seconds
    time += parseFloat(parts[0])*60*60;
    // minutes => seconds
    time += parseFloat(parts[1])*60;
    // get seconds
    var seconds = parts[2].split(/\.|,/); // Either . or ,
    time += parseFloat(seconds[0]);
    // add miliseconds
    ms = parseFloat(seconds[1]);
    if (ms) { time += ms/1000; }
    return time;
  },

  buildSubtitles: function(){
    /* Creating this HTML
      <div class="ajs-subtitles"></div>
    */
    this.subtitlesDisplay = _V_.createElement("div", { className: 'ajs-subtitles' });
    this.box.appendChild(this.subtitlesDisplay);
    this.activateElement(this.subtitlesDisplay, "subtitlesDisplay");
  },

  /* Player API - Translate functionality from player to audio
  ================================================================================ */
  addAudioListener: function(type, fn){ _V_.addListener(this.audio, type, fn.rEvtContext(this)); },

  play: function(){
    this.audio.play();
    return this;
  },
  onPlay: function(fn){ this.addAudioListener("play", fn); return this; },

  pause: function(){
    this.audio.pause();
    return this;
  },
  onPause: function(fn){ this.addAudioListener("pause", fn); return this; },
  paused: function() { return this.audio.paused; },

  currentTime: function(seconds){
    if (seconds !== undefined) {
      try { this.audio.currentTime = seconds; }
      catch(e) { this.warning(AudioJS.warnings.audioNotReady); }
      this.values.currentTime = seconds;
      return this;
    }
    return this.audio.currentTime;
  },
  onCurrentTimeUpdate: function(fn){
    this.currentTimeListeners.push(fn);
  },

  duration: function(){
    return this.audio.duration;
  },

  buffered: function(){
    // Storing values allows them be overridden by setBufferedFromProgress
    if (this.values.bufferStart === undefined) {
      this.values.bufferStart = 0;
      this.values.bufferEnd = 0;
    }
    if (this.audio.buffered && this.audio.buffered.length > 0) {
      var newEnd = this.audio.buffered.end(0);
      if (newEnd > this.values.bufferEnd) { this.values.bufferEnd = newEnd; }
    }
    return [this.values.bufferStart, this.values.bufferEnd];
  },

  volume: function(percentAsDecimal){
    if (percentAsDecimal !== undefined) {
      // Force value to between 0 and 1
      this.values.volume = Math.max(0, Math.min(1, parseFloat(percentAsDecimal)));
      this.audio.volume = this.values.volume;
      this.setLocalStorage("volume", this.values.volume);
      return this;
    }
    if (this.values.volume) { return this.values.volume; }
    return this.audio.volume;
  },
  onVolumeChange: function(fn){ _V_.addListener(this.audio, 'volumechange', fn.rEvtContext(this)); },

  width: function(width){
    if (width !== undefined) {
      this.audio.width = width; // Not using style so it can be overridden
      this.box.style.width = width+"px";
      this.triggerResizeListeners();
      return this;
    }
    return this.audio.offsetWidth || 400;
  },
  height: function(height){
    if (height !== undefined) {
      this.audio.height = height;
      this.box.style.height = height+"px";
      this.triggerResizeListeners();
      return this;
    }
    return this.audio.offsetHeight;
  },

  onError: function(fn){ this.addAudioListener("error", fn); return this; },
  onEnded: function(fn){
    this.addAudioListener("ended", fn); return this;
  }
});

////////////////////////////////////////////////////////////////////////////////
// Element Behaviors
// Tell elements how to act or react
////////////////////////////////////////////////////////////////////////////////

/* Player Behaviors - How AudioJS reacts to what the audio is doing.
================================================================================ */
AudioJS.player.newBehavior("player", function(player){
    this.onError(this.playerOnAudioError);
    // Listen for when the audio is played
    this.onPlay(this.playerOnAudioPlay);
    this.onPlay(this.trackCurrentTime);
    // Listen for when the audio is paused
    this.onPause(this.playerOnAudioPause);
    this.onPause(this.stopTrackingCurrentTime);
    // Listen for when the audio ends
    this.onEnded(this.playerOnAudioEnded);
    // Set interval for load progress using buffer watching method
    // this.trackCurrentTime();
    this.trackBuffered();
    // Buffer Full
    this.onBufferedUpdate(this.isBufferFull);
  },{
    playerOnAudioError: function(event){
      this.log(event);
      this.log(this.audio.error);
    },
    playerOnAudioPlay: function(event){ this.hasPlayed = true; },
    playerOnAudioPause: function(event){},
    playerOnAudioEnded: function(event){
      this.currentTime(0);
      this.pause();
    },

    /* Load Tracking -------------------------------------------------------------- */
    // Buffer watching method for load progress.
    // Used for browsers that don't support the progress event
    trackBuffered: function(){
      this.bufferedInterval = setInterval(this.triggerBufferedListeners.context(this), 500);
    },
    stopTrackingBuffered: function(){ clearInterval(this.bufferedInterval); },
    bufferedListeners: [],
    onBufferedUpdate: function(fn){
      this.bufferedListeners.push(fn);
    },
    triggerBufferedListeners: function(){
      this.isBufferFull();
      this.each(this.bufferedListeners, function(listener){
        (listener.context(this))();
      });
    },
    isBufferFull: function(){
      if (this.bufferedPercent() == 1) { this.stopTrackingBuffered(); }
    },

    /* Time Tracking -------------------------------------------------------------- */
    trackCurrentTime: function(){
      if (this.currentTimeInterval) { clearInterval(this.currentTimeInterval); }
      this.currentTimeInterval = setInterval(this.triggerCurrentTimeListeners.context(this), 100); // 42 = 24 fps
      this.trackingCurrentTime = true;
    },
    // Turn off play progress tracking (when paused or dragging)
    stopTrackingCurrentTime: function(){
      clearInterval(this.currentTimeInterval);
      this.trackingCurrentTime = false;
    },
    currentTimeListeners: [],
    // onCurrentTimeUpdate is in API section now
    triggerCurrentTimeListeners: function(late, newTime){ // FF passes milliseconds late as the first argument
      this.each(this.currentTimeListeners, function(listener){
        (listener.context(this))(newTime || this.currentTime());
      });
    },

    /* Resize Tracking -------------------------------------------------------------- */
    resizeListeners: [],
    onResize: function(fn){
      this.resizeListeners.push(fn);
    },
    // Trigger anywhere the audio/box size is changed.
    triggerResizeListeners: function(){
      this.each(this.resizeListeners, function(listener){
        (listener.context(this))();
      });
    }
  }
);
/* Mouse Over Audio Reporter Behaviors - i.e. Controls hiding based on mouse location
================================================================================ */
AudioJS.player.newBehavior("mouseOverAudioReporter", function(element){
    // Listen for the mouse move the audio. Used to reveal the controller.
    _V_.addListener(element, "mousemove", this.mouseOverAudioReporterOnMouseMove.context(this));
    // Listen for the mouse moving out of the audio. Used to hide the controller.
    _V_.addListener(element, "mouseout", this.mouseOverAudioReporterOnMouseOut.context(this));
  },{
    mouseOverAudioReporterOnMouseMove: function(){
      this.showControlBars();
      clearInterval(this.mouseMoveTimeout);
      this.mouseMoveTimeout = setTimeout(this.hideControlBars.context(this), 4000);
    },
    mouseOverAudioReporterOnMouseOut: function(event){
      // Prevent flicker by making sure mouse hasn't left the audio
      var parent = event.relatedTarget;
      while (parent && parent !== this.box) {
        parent = parent.parentNode;
      }
      if (parent !== this.box) {
        this.hideControlBars();
      }
    }
  }
);
/* Mouse Over Audio Reporter Behaviors - i.e. Controls hiding based on mouse location
================================================================================ */
AudioJS.player.newBehavior("box", function(element){
    this.positionBox();
    _V_.addClass(element, "ajs-paused");
    this.activateElement(element, "mouseOverAudioReporter");
    this.onPlay(this.boxOnAudioPlay);
    this.onPause(this.boxOnAudioPause);
  },{
    boxOnAudioPlay: function(){
      _V_.removeClass(this.box, "ajs-paused");
      _V_.addClass(this.box, "ajs-playing");
    },
    boxOnAudioPause: function(){
      _V_.removeClass(this.box, "ajs-playing");
      _V_.addClass(this.box, "ajs-paused");
    }
  }
);

/* Control Bar Behaviors
================================================================================ */
AudioJS.player.newBehavior("controlBar", function(element){
    if (!this.controlBars) {
      this.controlBars = [];
      this.onResize(this.positionControlBars);
    }
    this.controlBars.push(element);
    _V_.addListener(element, "mousemove", this.onControlBarsMouseMove.context(this));
    _V_.addListener(element, "mouseout", this.onControlBarsMouseOut.context(this));
  },{
    showControlBars: function(){
      if (!this.options.controlsAtStart && !this.hasPlayed) { return; }
      this.each(this.controlBars, function(bar){
        bar.style.display = "block";
      });
    },
    // Place controller relative to the audio's position (now just resizing bars)
    positionControlBars: function(){
      this.updatePlayProgressBars();
      this.updateLoadProgressBars();
    },
    hideControlBars: function(){
      if (this.options.controlsHiding && !this.mouseIsOverControls) {
        this.each(this.controlBars, function(bar){
          bar.style.display = "none";
        });
      }
    },
    // Block controls from hiding when mouse is over them.
    onControlBarsMouseMove: function(){ this.mouseIsOverControls = true; },
    onControlBarsMouseOut: function(event){
      this.mouseIsOverControls = false;
    }
  }
);
/* PlayToggle, PlayButton, PauseButton Behaviors
================================================================================ */
// Play Toggle
AudioJS.player.newBehavior("playToggle", function(element){
    if (!this.elements.playToggles) {
      this.elements.playToggles = [];
      this.onPlay(this.playTogglesOnPlay);
      this.onPause(this.playTogglesOnPause);
    }
    this.elements.playToggles.push(element);
    _V_.addListener(element, "click", this.onPlayToggleClick.context(this));
  },{
    onPlayToggleClick: function(event){
      if (this.paused()) {
        this.play();
      } else {
        this.pause();
      }
    },
    playTogglesOnPlay: function(event){
      this.each(this.elements.playToggles, function(toggle){
        _V_.removeClass(toggle, "ajs-paused");
        _V_.addClass(toggle, "ajs-playing");
      });
    },
    playTogglesOnPause: function(event){
      this.each(this.elements.playToggles, function(toggle){
        _V_.removeClass(toggle, "ajs-playing");
        _V_.addClass(toggle, "ajs-paused");
      });
    }
  }
);
// Play
AudioJS.player.newBehavior("playButton", function(element){
    _V_.addListener(element, "click", this.onPlayButtonClick.context(this));
  },{
    onPlayButtonClick: function(event){ this.play(); }
  }
);
// Pause
AudioJS.player.newBehavior("pauseButton", function(element){
    _V_.addListener(element, "click", this.onPauseButtonClick.context(this));
  },{
    onPauseButtonClick: function(event){ this.pause(); }
  }
);
/* Play Progress Bar Behaviors
================================================================================ */
AudioJS.player.newBehavior("playProgressBar", function(element){
    if (!this.playProgressBars) {
      this.playProgressBars = [];
      this.onCurrentTimeUpdate(this.updatePlayProgressBars);
    }
    this.playProgressBars.push(element);
  },{
    // Ajust the play progress bar's width based on the current play time
    updatePlayProgressBars: function(newTime){
      var progress = (newTime !== undefined) ? newTime / this.duration() : this.currentTime() / this.duration();
      if (isNaN(progress)) { progress = 0; }
      this.each(this.playProgressBars, function(bar){
        if (bar.style) { bar.style.width = _V_.round(progress * 100, 2) + "%"; }
      });
    }
  }
);
/* Load Progress Bar Behaviors
================================================================================ */
AudioJS.player.newBehavior("loadProgressBar", function(element){
    if (!this.loadProgressBars) { this.loadProgressBars = []; }
    this.loadProgressBars.push(element);
    this.onBufferedUpdate(this.updateLoadProgressBars);
  },{
    updateLoadProgressBars: function(){
      this.each(this.loadProgressBars, function(bar){
        if (bar.style) { bar.style.width = _V_.round(this.bufferedPercent() * 100, 2) + "%"; }
      });
    }
  }
);

/* Current Time Display Behaviors
================================================================================ */
AudioJS.player.newBehavior("currentTimeDisplay", function(element){
    if (!this.currentTimeDisplays) {
      this.currentTimeDisplays = [];
      this.onCurrentTimeUpdate(this.updateCurrentTimeDisplays);
    }
    this.currentTimeDisplays.push(element);
  },{
    // Update the displayed time (00:00)
    updateCurrentTimeDisplays: function(newTime){
      if (!this.currentTimeDisplays) { return; }
      // Allows for smooth scrubbing, when player can't keep up.
      var time = (newTime) ? newTime : this.currentTime();
      this.each(this.currentTimeDisplays, function(dis){
        dis.innerHTML = _V_.formatTime(time);
      });
    }
  }
);

/* Duration Display Behaviors
================================================================================ */
AudioJS.player.newBehavior("durationDisplay", function(element){
    if (!this.durationDisplays) {
      this.durationDisplays = [];
      this.onCurrentTimeUpdate(this.updateDurationDisplays);
    }
    this.durationDisplays.push(element);
  },{
    updateDurationDisplays: function(){
      if (!this.durationDisplays) { return; }
      this.each(this.durationDisplays, function(dis){
        if (this.duration()) { dis.innerHTML = _V_.formatTime(this.duration()); }
      });
    }
  }
);

/* Current Time Scrubber Behaviors
================================================================================ */
AudioJS.player.newBehavior("currentTimeScrubber", function(element){
    _V_.addListener(element, "mousedown", this.onCurrentTimeScrubberMouseDown.rEvtContext(this));
  },{
    // Adjust the play position when the user drags on the progress bar
    onCurrentTimeScrubberMouseDown: function(event, scrubber){
      event.preventDefault();
      this.currentScrubber = scrubber;

      this.stopTrackingCurrentTime(); // Allows for smooth scrubbing

      this.audioWasPlaying = !this.paused();
      this.pause();

      _V_.blockTextSelection();
      this.setCurrentTimeWithScrubber(event);
      _V_.addListener(document, "mousemove", this.onCurrentTimeScrubberMouseMove.rEvtContext(this));
      _V_.addListener(document, "mouseup", this.onCurrentTimeScrubberMouseUp.rEvtContext(this));
    },
    onCurrentTimeScrubberMouseMove: function(event){ // Removeable
      this.setCurrentTimeWithScrubber(event);
    },
    onCurrentTimeScrubberMouseUp: function(event){ // Removeable
      _V_.unblockTextSelection();
      document.removeEventListener("mousemove", this.onCurrentTimeScrubberMouseMove, false);
      document.removeEventListener("mouseup", this.onCurrentTimeScrubberMouseUp, false);
      if (this.audioWasPlaying) {
        this.play();
        this.trackCurrentTime();
      }
    },
    setCurrentTimeWithScrubber: function(event){
      var newProgress = _V_.getRelativePosition(event.pageX, this.currentScrubber);
      var newTime = newProgress * this.duration();
      this.triggerCurrentTimeListeners(0, newTime); // Allows for smooth scrubbing
      // Don't let audio end while scrubbing.
      if (newTime == this.duration()) { newTime = newTime - 0.1; }
      this.currentTime(newTime);
    }
  }
);
/* Volume Display Behaviors
================================================================================ */
AudioJS.player.newBehavior("volumeDisplay", function(element){
    if (!this.volumeDisplays) {
      this.volumeDisplays = [];
      this.onVolumeChange(this.updateVolumeDisplays);
    }
    this.volumeDisplays.push(element);
    this.updateVolumeDisplay(element); // Set the display to the initial volume
  },{
    // Update the volume control display
    // Unique to these default controls. Uses borders to create the look of bars.
    updateVolumeDisplays: function(){
      if (!this.volumeDisplays) { return; }
      this.each(this.volumeDisplays, function(dis){
        this.updateVolumeDisplay(dis);
      });
    },
    updateVolumeDisplay: function(display){
      var volNum = Math.ceil(this.volume() * 6);
      this.each(display.children, function(child, num){
        if (num < volNum) {
          _V_.addClass(child, "ajs-volume-level-on");
        } else {
          _V_.removeClass(child, "ajs-volume-level-on");
        }
      });
    }
  }
);
/* Volume Scrubber Behaviors
================================================================================ */
AudioJS.player.newBehavior("volumeScrubber", function(element){
    _V_.addListener(element, "mousedown", this.onVolumeScrubberMouseDown.rEvtContext(this));
  },{
    // Adjust the volume when the user drags on the volume control
    onVolumeScrubberMouseDown: function(event, scrubber){
      // event.preventDefault();
      _V_.blockTextSelection();
      this.currentScrubber = scrubber;
      this.setVolumeWithScrubber(event);
      _V_.addListener(document, "mousemove", this.onVolumeScrubberMouseMove.rEvtContext(this));
      _V_.addListener(document, "mouseup", this.onVolumeScrubberMouseUp.rEvtContext(this));
    },
    onVolumeScrubberMouseMove: function(event){
      this.setVolumeWithScrubber(event);
    },
    onVolumeScrubberMouseUp: function(event){
      this.setVolumeWithScrubber(event);
      _V_.unblockTextSelection();
      document.removeEventListener("mousemove", this.onVolumeScrubberMouseMove, false);
      document.removeEventListener("mouseup", this.onVolumeScrubberMouseUp, false);
    },
    setVolumeWithScrubber: function(event){
      var newVol = _V_.getRelativePosition(event.pageX, this.currentScrubber);
      this.volume(newVol);
    }
  }
);
/* Spinner
================================================================================ */
AudioJS.player.newBehavior("spinner", function(element){
    if (!this.spinners) {
      this.spinners = [];
      _V_.addListener(this.audio, "loadeddata", this.spinnersOnAudioLoadedData.context(this));
      _V_.addListener(this.audio, "loadstart", this.spinnersOnAudioLoadStart.context(this));
      _V_.addListener(this.audio, "seeking", this.spinnersOnAudioSeeking.context(this));
      _V_.addListener(this.audio, "seeked", this.spinnersOnAudioSeeked.context(this));
      _V_.addListener(this.audio, "canplay", this.spinnersOnAudioCanPlay.context(this));
      _V_.addListener(this.audio, "canplaythrough", this.spinnersOnAudioCanPlayThrough.context(this));
      _V_.addListener(this.audio, "waiting", this.spinnersOnAudioWaiting.context(this));
      _V_.addListener(this.audio, "stalled", this.spinnersOnAudioStalled.context(this));
      _V_.addListener(this.audio, "suspend", this.spinnersOnAudioSuspend.context(this));
      _V_.addListener(this.audio, "playing", this.spinnersOnAudioPlaying.context(this));
      _V_.addListener(this.audio, "timeupdate", this.spinnersOnAudioTimeUpdate.context(this));
    }
    this.spinners.push(element);
  },{
    showSpinners: function(){
      this.each(this.spinners, function(spinner){
        spinner.style.display = "block";
      });
      clearInterval(this.spinnerInterval);
      this.spinnerInterval = setInterval(this.rotateSpinners.context(this), 100);
    },
    hideSpinners: function(){
      this.each(this.spinners, function(spinner){
        spinner.style.display = "none";
      });
      clearInterval(this.spinnerInterval);
    },
    spinnersRotated: 0,
    rotateSpinners: function(){
      this.each(this.spinners, function(spinner){
        // spinner.style.transform =       'scale(0.5) rotate('+this.spinnersRotated+'deg)';
        spinner.style.WebkitTransform = 'scale(0.5) rotate('+this.spinnersRotated+'deg)';
        spinner.style.MozTransform =    'scale(0.5) rotate('+this.spinnersRotated+'deg)';
      });
      if (this.spinnersRotated == 360) { this.spinnersRotated = 0; }
      this.spinnersRotated += 45;
    },
    spinnersOnAudioLoadedData: function(event){ this.hideSpinners(); },
    spinnersOnAudioLoadStart: function(event){ this.showSpinners(); },
    spinnersOnAudioSeeking: function(event){ /* this.showSpinners(); */ },
    spinnersOnAudioSeeked: function(event){ /* this.hideSpinners(); */ },
    spinnersOnAudioCanPlay: function(event){ /* this.hideSpinners(); */ },
    spinnersOnAudioCanPlayThrough: function(event){ this.hideSpinners(); },
    spinnersOnAudioWaiting: function(event){
      // Safari sometimes triggers waiting inappropriately
      // Like after audio has played, any you play again.
      this.showSpinners();
    },
    spinnersOnAudioStalled: function(event){},
    spinnersOnAudioSuspend: function(event){},
    spinnersOnAudioPlaying: function(event){ this.hideSpinners(); },
    spinnersOnAudioTimeUpdate: function(event){
      // Safari sometimes calls waiting and doesn't recover
      if(this.spinner.style.display == "block") { this.hideSpinners(); }
    }
  }
);
/* Subtitles
================================================================================ */
AudioJS.player.newBehavior("subtitlesDisplay", function(element){
    if (!this.subtitleDisplays) {
      this.subtitleDisplays = [];
      this.onCurrentTimeUpdate(this.subtitleDisplaysOnAudioTimeUpdate);
      this.onEnded(function() { this.lastSubtitleIndex = 0; }.context(this));
    }
    this.subtitleDisplays.push(element);
  },{
    subtitleDisplaysOnAudioTimeUpdate: function(time){
      // Assuming all subtitles are in order by time, and do not overlap
      if (this.subtitles) {
        // If current subtitle should stay showing, don't do anything. Otherwise, find new subtitle.
        if (!this.currentSubtitle || this.currentSubtitle.start >= time || this.currentSubtitle.end < time) {
          var newSubIndex = false,
              // Loop in reverse if lastSubtitle is after current time (optimization)
              // Meaning the user is scrubbing in reverse or rewinding
              reverse = (this.subtitles[this.lastSubtitleIndex].start > time),
              // If reverse, step back 1 becase we know it's not the lastSubtitle
              i = this.lastSubtitleIndex - (reverse) ? 1 : 0;
          while (true) { // Loop until broken
            if (reverse) { // Looping in reverse
              // Stop if no more, or this subtitle ends before the current time (no earlier subtitles should apply)
              if (i < 0 || this.subtitles[i].end < time) { break; }
              // End is greater than time, so if start is less, show this subtitle
              if (this.subtitles[i].start < time) {
                newSubIndex = i;
                break;
              }
              i--;
            } else { // Looping forward
              // Stop if no more, or this subtitle starts after time (no later subtitles should apply)
              if (i >= this.subtitles.length || this.subtitles[i].start > time) { break; }
              // Start is less than time, so if end is later, show this subtitle
              if (this.subtitles[i].end > time) {
                newSubIndex = i;
                break;
              }
              i++;
            }
          }

          // Set or clear current subtitle
          if (newSubIndex !== false) {
            this.currentSubtitle = this.subtitles[newSubIndex];
            this.lastSubtitleIndex = newSubIndex;
            this.updateSubtitleDisplays(this.currentSubtitle.text);
          } else if (this.currentSubtitle) {
            this.currentSubtitle = false;
            this.updateSubtitleDisplays("");
          }
        }
      }
    },
    updateSubtitleDisplays: function(val){
      this.each(this.subtitleDisplays, function(disp){
        disp.innerHTML = val;
      });
    }
  }
);

////////////////////////////////////////////////////////////////////////////////
// Convenience Functions (mini library)
// Functions not specific to Audio or AudioJS and could probably be replaced with a library like jQuery
////////////////////////////////////////////////////////////////////////////////

AudioJS.extend({

  addClass: function(element, classToAdd){
    if ((" "+element.className+" ").indexOf(" "+classToAdd+" ") == -1) {
      element.className = element.className === "" ? classToAdd : element.className + " " + classToAdd;
    }
  },
  removeClass: function(element, classToRemove){
    if (element.className.indexOf(classToRemove) == -1) { return; }
    var classNames = element.className.split(/\s+/);
    classNames.splice(classNames.lastIndexOf(classToRemove),1);
    element.className = classNames.join(" ");
  },
  createElement: function(tagName, attributes){
    return this.merge(document.createElement(tagName), attributes);
  },

  // Attempt to block the ability to select text while dragging controls
  blockTextSelection: function(){
    document.body.focus();
    document.onselectstart = function () { return false; };
  },
  // Turn off text selection blocking
  unblockTextSelection: function(){ document.onselectstart = function () { return true; }; },

  // Return seconds as MM:SS
  formatTime: function(secs) {
    var seconds = Math.round(secs);
    var minutes = Math.floor(seconds / 60);
    minutes = (minutes >= 10) ? minutes : "0" + minutes;
    seconds = Math.floor(seconds % 60);
    seconds = (seconds >= 10) ? seconds : "0" + seconds;
    return minutes + ":" + seconds;
  },

  // Return the relative horizonal position of an event as a value from 0-1
  getRelativePosition: function(x, relativeElement){
    return Math.max(0, Math.min(1, (x - this.findPosX(relativeElement)) / relativeElement.offsetWidth));
  },
  // Get an objects position on the page
  findPosX: function(obj) {
    var curleft = obj.offsetLeft;
    while(obj = obj.offsetParent) {
      curleft += obj.offsetLeft;
    }
    return curleft;
  },
  getComputedStyleValue: function(element, style){
    return window.getComputedStyle(element, null).getPropertyValue(style);
  },

  round: function(num, dec) {
    if (!dec) { dec = 0; }
    return Math.round(num*Math.pow(10,dec))/Math.pow(10,dec);
  },

  addListener: function(element, type, handler){
    if (element.addEventListener) {
      element.addEventListener(type, handler, false);
    } else if (element.attachEvent) {
      element.attachEvent("on"+type, handler);
    }
  },
  removeListener: function(element, type, handler){
    if (element.removeEventListener) {
      element.removeEventListener(type, handler, false);
    } else if (element.attachEvent) {
      element.detachEvent("on"+type, handler);
    }
  },

  get: function(url, onSuccess){
    if (typeof XMLHttpRequest == "undefined") {
      XMLHttpRequest = function () {
        try { return new ActiveXObject("Msxml2.XMLHTTP.6.0"); } catch (e) {}
        try { return new ActiveXObject("Msxml2.XMLHTTP.3.0"); } catch (f) {}
        try { return new ActiveXObject("Msxml2.XMLHTTP"); } catch (g) {}
        //Microsoft.XMLHTTP points to Msxml2.XMLHTTP.3.0 and is redundant
        throw new Error("This browser does not support XMLHttpRequest.");
      };
    }
    var request = new XMLHttpRequest();
    request.open("GET",url);
    request.onreadystatechange = function() {
      if (request.readyState == 4 && request.status == 200) {
        onSuccess(request.responseText);
      }
    }.context(this);
    request.send();
  },

  trim: function(string){ return string.toString().replace(/^\s+/, "").replace(/\s+$/, ""); },

  // DOM Ready functionality adapted from jQuery. http://jquery.com/
  bindDOMReady: function(){
    if (document.readyState === "complete") {
      return AudioJS.onDOMReady();
    }
    if (document.addEventListener) {
      document.addEventListener("DOMContentLoaded", AudioJS.DOMContentLoaded, false);
      window.addEventListener("load", AudioJS.onDOMReady, false);
    } else if (document.attachEvent) {
      document.attachEvent("onreadystatechange", AudioJS.DOMContentLoaded);
      window.attachEvent("onload", AudioJS.onDOMReady);
    }
  },

  DOMContentLoaded: function(){
    if (document.addEventListener) {
      document.removeEventListener( "DOMContentLoaded", AudioJS.DOMContentLoaded, false);
      AudioJS.onDOMReady();
    } else if ( document.attachEvent ) {
      if ( document.readyState === "complete" ) {
        document.detachEvent("onreadystatechange", AudioJS.DOMContentLoaded);
        AudioJS.onDOMReady();
      }
    }
  },

  // Functions to be run once the DOM is loaded
  DOMReadyList: [],
  addToDOMReady: function(fn){
    if (AudioJS.DOMIsReady) {
      fn.call(document);
    } else {
      AudioJS.DOMReadyList.push(fn);
    }
  },

  DOMIsReady: false,
  onDOMReady: function(){
    if (AudioJS.DOMIsReady) { return; }
    if (!document.body) { return setTimeout(AudioJS.onDOMReady, 13); }
    AudioJS.DOMIsReady = true;
    if (AudioJS.DOMReadyList) {
      for (var i=0; i<AudioJS.DOMReadyList.length; i++) {
        AudioJS.DOMReadyList[i].call(document);
      }
      AudioJS.DOMReadyList = null;
    }
  }
});
AudioJS.bindDOMReady();

// Allows for binding context to functions
// when using in event listeners and timeouts
Function.prototype.context = function(obj){
  var method = this,
  temp = function(){
    return method.apply(obj, arguments);
  };
  return temp;
};

// Like context, in that it creates a closure
// But insteaad keep "this" intact, and passes the var as the second argument of the function
// Need for event listeners where you need to know what called the event
// Only use with event callbacks
Function.prototype.evtContext = function(obj){
  var method = this,
  temp = function(){
    var origContext = this;
    return method.call(obj, arguments[0], origContext);
  };
  return temp;
};

// Removeable Event listener with Context
// Replaces the original function with a version that has context
// So it can be removed using the original function name.
// In order to work, a version of the function must already exist in the player/prototype
Function.prototype.rEvtContext = function(obj, funcParent){
  if (this.hasContext === true) { return this; }
  if (!funcParent) { funcParent = obj; }
  for (var attrname in funcParent) {
    if (funcParent[attrname] == this) {
      funcParent[attrname] = this.evtContext(obj);
      funcParent[attrname].hasContext = true;
      return funcParent[attrname];
    }
  }
  return this.evtContext(obj);
};

// jQuery Plugin
if (window.jQuery) {
  (function($) {
    $.fn.AudioJS = function(options) {
      this.each(function() {
        AudioJS.setup(this, options);
      });
      return this;
    };
    $.fn.player = function() {
      return this[0].player;
    };
  })(jQuery);
}


// Expose to global
window.AudioJS = window._V_ = AudioJS;

// End self-executing function
})(window);