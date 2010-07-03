/*
This file is part of AudioJS. Copyright 2010 Zencoder, Inc.

Modified for html5 audio tag by dz0ny

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

// Store a list of players on the page for reference
var audioJSPlayers = new Array();

// Using jresig's Class implementation http://ejohn.org/blog/simple-javascript-inheritance/
(function(){var initializing=false, fnTest=/xyz/.test(function(){xyz;}) ? /\b_super\b/ : /.*/; this.Class = function(){}; Class.extend = function(prop) { var _super = this.prototype; initializing = true; var prototype = new this(); initializing = false; for (var name in prop) { prototype[name] = typeof prop[name] == "function" && typeof _super[name] == "function" && fnTest.test(prop[name]) ? (function(name, fn){ return function() { var tmp = this._super; this._super = _super[name]; var ret = fn.apply(this, arguments); this._super = tmp; return ret; }; })(name, prop[name]) : prop[name]; } function Class() { if ( !initializing && this.init ) this.init.apply(this, arguments); } Class.prototype = prototype; Class.constructor = Class; Class.extend = arguments.callee; return Class;};})();

// Audio JS Player Class
var AudioJS = Class.extend({

  // Initialize the player for the supplied audio tag element
  // element: audio tag
  // num: the current player's position in the audioJSPlayers array
  init: function(element, setOptions){

    this.audio = element;

    // Default Options
    this.options = {
      num: 0, // Optional tracking of audioJSPLayers position
      defaultVolume: 0.85, // Will be overridden by localStorage volume if available
      linksHiding: true
    };
    
    // Override default options with set options
    if (typeof setOptions == "object") _V_.merge(this.options, setOptions);

    this.box = this.audio.parentNode;
    this.percentLoaded = 0;

    if (this.options.controlsBelow) {
      _V_.addClass(this.box, "vjs-controls-below");
    }


    // Hide default controls
    this.audio.controls = false;

    this.buildController();
    this.showController();

    // Position & show controls when data is loaded
    this.audio.addEventListener("loadeddata", this.onLoadedData.context(this), false);

    // Listen for when the audio is played
    this.audio.addEventListener("play", this.onPlay.context(this), false);
    // Listen for when the audio is paused
    this.audio.addEventListener("pause", this.onPause.context(this), false);
    // Listen for when the audio ends
    this.audio.addEventListener("ended", this.onEnded.context(this), false);
    // Listen for a volume change
    this.audio.addEventListener('volumechange',this.onVolumeChange.context(this),false);
    // Listen for audio errors
    this.audio.addEventListener('error',this.onError.context(this),false);
    // Listen for Audio Load Progress (currently does not if html file is local)
    this.audio.addEventListener('progress', this.onProgress.context(this), false);
    // Set interval for load progress using buffer watching method
    this.watchBuffer = setInterval(this.updateBufferedTotal.context(this), 33);

    // Listen for clicks on the play/pause button
    this.playControl.addEventListener("click", this.onPlayControlClick.context(this), false);
    // Make a click on the audio act like a click on the play button.
    this.audio.addEventListener("click", this.onPlayControlClick.context(this), false);
    // Make a click on the poster act like a click on the play button.
    if (this.poster) this.poster.addEventListener("click", this.onPlayControlClick.context(this), false);

    // Listen for drags on the progress bar
    this.progressHolder.addEventListener("mousedown", this.onProgressHolderMouseDown.context(this), false);
    // Listen for a release on the progress bar
    this.progressHolder.addEventListener("mouseup", this.onProgressHolderMouseUp.context(this), false);

    // Set to stored volume OR 85%
    this.setVolume(localStorage.volume || this.options.defaultVolume);
    // Listen for a drag on the volume control
    this.volumeControl.addEventListener("mousedown", this.onVolumeControlMouseDown.context(this), false);
    // Listen for a release on the volume control
    this.volumeControl.addEventListener("mouseup", this.onVolumeControlMouseUp.context(this), false);
    // Set the display to the initial volume
    this.updateVolumeDisplay();

    this.onWindowResize = function(event){
      this.positionController();
    }.context(this);

    // Support older browsers that used autobuffer
    this.fixPreloading()
  },
  
  // Support older browsers that used "autobuffer"
  fixPreloading: function(){
    if (typeof this.audio.hasAttribute == "function" && this.audio.hasAttribute("preload")) {
      this.audio.autobuffer = true;
    }
  },

  buildController: function(){

    /* Creating this HTML
      <ul class="vjs-controls">
        <li class="vjs-play-control vjs-play">
          <span></span>
        </li>
        <li class="vjs-progress-control">
          <ul class="vjs-progress-holder">
            <li class="vjs-load-progress"></li>
            <li class="vjs-play-progress"></li>
          </ul>
        </li>
        <li class="vjs-time-control">
          <span class="vjs-current-time-display">00:00</span><span> / </span><span class="vjs-duration-display">00:00</span>
        </li>
        <li class="vjs-volume-control">
          <ul>
            <li></li><li></li><li></li><li></li><li></li><li></li>
          </ul>
        </li>
      </ul>
    */

    // Create a list element to hold the different controls
    this.controls = _V_.createElement("ul", { className: "vjs-controls" });
    // Add the controls to the audio's container
    this.audio.parentNode.appendChild(this.controls);

    // Build the play control
    this.playControl = _V_.createElement("li", { className: "vjs-play-control vjs-play", innerHTML: "<span></span>" });
    this.controls.appendChild(this.playControl);

    // Build the progress control
    this.progressControl = _V_.createElement("li", { className: "vjs-progress-control" });
    this.controls.appendChild(this.progressControl);

    // Create a holder for the progress bars
    this.progressHolder = _V_.createElement("ul", { className: "vjs-progress-holder" });
    this.progressControl.appendChild(this.progressHolder);

    // Create the loading progress display
    this.loadProgress = _V_.createElement("li", { className: "vjs-load-progress" });
    this.progressHolder.appendChild(this.loadProgress)

    // Create the playing progress display
    this.playProgress = _V_.createElement("li", { className: "vjs-play-progress" });
    this.progressHolder.appendChild(this.playProgress);

    // Create the progress time display (00:00 / 00:00)
    this.timeControl = _V_.createElement("li", { className: "vjs-time-control" });
    this.controls.appendChild(this.timeControl);

    // Create the current play time display
    this.currentTimeDisplay = _V_.createElement("span", { className: "vjs-current-time-display", innerHTML: "00:00" });
    this.timeControl.appendChild(this.currentTimeDisplay);

    // Add time separator
    this.timeSeparator = _V_.createElement("span", { innerHTML: " / " });
    this.timeControl.appendChild(this.timeSeparator);

    // Create the total duration display
    this.durationDisplay = _V_.createElement("span", { className: "vjs-duration-display", innerHTML: "00:00" });
    this.timeControl.appendChild(this.durationDisplay);

    // Create the volumne control
    this.volumeControl = _V_.createElement("li", {
      className: "vjs-volume-control",
      innerHTML: "<ul><li></li><li></li><li></li><li></li><li></li><li></li></ul>"
    });
    this.controls.appendChild(this.volumeControl);
    this.volumeDisplay = this.volumeControl.children[0]

  },

  // Show the controller
  showController: function(){
    this.controls.style.display = "block";
    this.positionController();
  },

  // Place controller relative to the audio's position
  positionController: function(){
    // Make sure the controls are visible
    if (this.controls.style.display == 'none') return;
    this.controls.style.height = this.audio.offsetHeight + this.controls.offsetHeight + "px";
    this.controls.style.width = "100px";

    this.sizeProgressBar();
  },


  canPlaySource: function(){
    var children = this.audio.children;
    for (var i=0; i<children.length; i++) {
      if (children[i].tagName.toUpperCase() == "SOURCE") {
        var canPlay = this.audio.canPlayType(children[i].type);
        if(canPlay == "probably" || canPlay == "maybe") {
          return true;
        }
      }
    }
    return false;
  },

  // When the audio is played
  onPlay: function(event){
    this.playControl.className = "vjs-play-control vjs-pause";
    this.trackPlayProgress();
  },

  // When the audio is paused
  onPause: function(event){
    this.playControl.className = "vjs-play-control vjs-play";
    this.stopTrackingPlayProgress();
  },

  // When the audio ends
  onEnded: function(event){
    this.audio.pause();
    this.onPause();
  },

  onVolumeChange: function(event){
    this.updateVolumeDisplay();
  },

  onError: function(event){
    console.log(event);
    console.log(this.audio.error);
  },

  onLoadedData: function(event){
    this.showController();
  },

  // When the audio's load progress is updated
  // Does not work in all browsers (Safari/Chrome 5)
  onProgress: function(event){
    if(event.total > 0) {
      this.setLoadProgress(event.loaded / event.total);
    }
  },

  // Buffer watching method for load progress.
  // Used for browsers that don't support the progress event
  updateBufferedTotal: function(){
    if (this.audio.buffered) {
      if (this.audio.buffered.length >= 1) {
        this.setLoadProgress(this.audio.buffered.end(0) / this.audio.duration);
        if (this.audio.buffered.end(0) == this.audio.duration) {
          clearInterval(this.watchBuffer);
        }
      }
    } else {
      clearInterval(this.watchBuffer);
    }
  },

  setLoadProgress: function(percentAsDecimal){
    if (percentAsDecimal > this.percentLoaded) {
      this.percentLoaded = percentAsDecimal;
      this.updateLoadProgress();
    }
  },

  updateLoadProgress: function(){
    if (this.controls.style.display == 'none') return;
    this.loadProgress.style.width = (this.percentLoaded * (_V_.getComputedStyleValue(this.progressHolder, "width").replace("px", ""))) + "px";
  },

  // React to clicks on the play/pause button
  onPlayControlClick: function(event){
    if (this.audio.paused) {
      this.audio.play();
    } else {
      this.audio.pause();
    }
  },

  // Adjust the play position when the user drags on the progress bar
  onProgressHolderMouseDown: function(event){
    this.stopTrackingPlayProgress();

    if (this.audio.paused) {
      this.audioWasPlaying = false;
    } else {
      this.audioWasPlaying = true;
      this.audio.pause();
    }

    _V_.blockTextSelection();
    document.onmousemove = function(event) {
      this.setPlayProgressWithEvent(event);
    }.context(this);

    document.onmouseup = function(event) {
      _V_.unblockTextSelection();
      document.onmousemove = null;
      document.onmouseup = null;
      if (this.audioWasPlaying) {
        this.audio.play();
        this.trackPlayProgress();
      }
    }.context(this);
  },

  // When the user stops dragging on the progress bar, update play position
  // Backup for when the user only clicks and doesn't drag
  onProgressHolderMouseUp: function(event){
    this.setPlayProgressWithEvent(event);
  },

  // Adjust the volume when the user drags on the volume control
  onVolumeControlMouseDown: function(event){
    _V_.blockTextSelection();
    document.onmousemove = function(event) {
      this.setVolumeWithEvent(event);
    }.context(this);
    document.onmouseup = function() {
      _V_.unblockTextSelection();
      document.onmousemove = null;
      document.onmouseup = null;
    }.context(this);
  },

  // When the user stops dragging, set a new volume
  // Backup for when the user only clicks and doesn't drag
  onVolumeControlMouseUp: function(event){
    this.setVolumeWithEvent(event);
  },

  // Adjust the width of the progress bar to fill the controls width
  sizeProgressBar: function(){
    // this.progressControl.style.width =
    //   this.controls.offsetWidth 
    //   - this.playControl.offsetWidth
    //   - this.volumeControl.offsetWidth
    //   - this.timeControl.offsetWidth
    //   - this.fullscreenControl.offsetWidth
    //   - (this.getControlsPadding() * 6) 
    //   - this.getControlBorderAdjustment() 
    //   + "px";
    // this.progressHolder.style.width = (this.progressControl.offsetWidth - (this.timeControl.offsetWidth + 20)) + "px";
    this.updatePlayProgress();
    this.updateLoadProgress();
  },
  
  // Get the space between controls. For more flexible styling.
  getControlsPadding: function(){
    return _V_.findPosX(this.playControl) - _V_.findPosX(this.controls)
  },
  
  // When dynamically placing controls, if there are borders on the controls, it can break to a new line.
  getControlBorderAdjustment: function(){
    var leftBorder = parseInt(_V_.getComputedStyleValue(this.playControl, "border-left-width").replace("px", ""));
    var rightBorder = parseInt(_V_.getComputedStyleValue(this.playControl, "border-right-width").replace("px", ""));
    return leftBorder + rightBorder;
  },

  // Track & display the current play progress
  trackPlayProgress: function(){
    this.playProgressInterval = setInterval(function(){ this.updatePlayProgress(); }.context(this), 33);
  },

  // Turn off play progress tracking (when paused)
  stopTrackingPlayProgress: function(){
    clearInterval(this.playProgressInterval);
  },

  // Ajust the play progress bar's width based on the current play time
  updatePlayProgress: function(){
    if (this.controls.style.display == 'none') return;
    this.playProgress.style.width = ((this.audio.currentTime / this.audio.duration) * (_V_.getComputedStyleValue(this.progressHolder, "width").replace("px", ""))) + "px";
    this.updateTimeDisplay();
  },

  // Update the play position based on where the user clicked on the progresss bar
  setPlayProgress: function(newProgress){
    this.audio.currentTime = newProgress * this.audio.duration;
    this.playProgress.style.width = newProgress * (_V_.getComputedStyleValue(this.progressHolder, "width").replace("px", "")) + "px";
    this.updateTimeDisplay();
  },

  setPlayProgressWithEvent: function(event){
    var newProgress = _V_.getRelativePosition(event.pageX, this.progressHolder);
    this.setPlayProgress(newProgress);
  },

  // Update the displayed time (00:00)
  updateTimeDisplay: function(){
    this.currentTimeDisplay.innerHTML = _V_.formatTime(this.audio.currentTime);
    if (this.audio.duration) this.durationDisplay.innerHTML = _V_.formatTime(this.audio.duration);
  },

  // Set a new volume based on where the user clicked on the volume control
  setVolume: function(newVol){
    this.audio.volume = parseFloat(newVol);
    localStorage.volume = this.audio.volume;
  },

  setVolumeWithEvent: function(event){
    var newVol = _V_.getRelativePosition(event.pageX, this.volumeControl.children[0]);
    this.setVolume(newVol);
  },

  // Update the volume control display
  // Unique to these default controls. Uses borders to create the look of bars.
  updateVolumeDisplay: function(){
    var volNum = Math.ceil(this.audio.volume * 6);
    for(var i=0; i<6; i++) {
      if (i < volNum) {
        _V_.addClass(this.volumeDisplay.children[i], "vjs-volume-level-on")
      } else {
        _V_.removeClass(this.volumeDisplay.children[i], "vjs-volume-level-on");
      }
    }
  },

})

// Convenience Functions (mini library)
// Functions not specific to audio or AudioJS and could be replaced with a library like jQuery
var _V_ = {
  addClass: function(element, classToAdd){
    if (element.className.split(/\s+/).lastIndexOf(classToAdd) == -1) element.className = element.className == "" ? classToAdd : element.className + " " + classToAdd;
  },

  removeClass: function(element, classToRemove){
    if (element.className.indexOf(classToRemove) == -1) return;
    var classNames = element.className.split(/\s+/);
    classNames.splice(classNames.lastIndexOf(classToRemove),1);
    element.className = classNames.join(" ");
  },

  merge: function(obj1, obj2){
    for (attrname in obj2) { obj1[attrname] = obj2[attrname]; }
    return obj1;
  },

  createElement: function(tagName, attributes){
    return _V_.merge(document.createElement(tagName), attributes);
  },

  // Attempt to block the ability to select text while dragging controls
  blockTextSelection: function(){
    document.body.focus();
    document.onselectstart = function () { return false; };
  },

  // Turn off text selection blocking
  unblockTextSelection: function(){
    document.onselectstart = function () { return true; };
  },

  // Return seconds as MM:SS
  formatTime: function(seconds) {
    seconds = Math.round(seconds);
    minutes = Math.floor(seconds / 60);
    minutes = (minutes >= 10) ? minutes : "0" + minutes;
    seconds = Math.floor(seconds % 60);
    seconds = (seconds >= 10) ? seconds : "0" + seconds;
    return minutes + ":" + seconds;
  },

  // Return the relative horizonal position of an event as a value from 0-1
  getRelativePosition: function(x, relativeElement){
    return Math.max(0, Math.min(1, (x - _V_.findPosX(relativeElement)) / relativeElement.offsetWidth));
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
  }
  
}

// Class Methods

// Add audio-js to any audio tag with the class
AudioJS.setup = function(options){
  var audioCount = document.getElementsByTagName("audio").length
  for (var i=0;i<audioCount;i++) {
    audioTag = document.getElementsByTagName("audio")[i];
    if (audioTag.className.indexOf("audio-js") != -1) {
      options = (options) ? _V_.merge(options, { num: i }) : options;
      audioJSPlayers[i] = new AudioJS(audioTag, options);
    }
  }
}

// Check if the browser supports audio.
AudioJS.browserSupportsAudio = function() {
  return !!document.createElement('audio').canPlayType;
}

AudioJS.isIpad = function(){
  return navigator.userAgent.match(/iPad/i) != null;
}

AudioJS.isIE = function(){
  return !+"\v1";
}

// Allows for binding context to functions
// when using in event listeners and timeouts
Function.prototype.context = function(obj) {
  var method = this
  temp = function() {
    return method.apply(obj, arguments)
  }
 return temp
}
