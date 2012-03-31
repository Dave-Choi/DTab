DTab = Ember.Application.create();

DTab.TabView = Ember.View.extend({
  templateName: "tab",
  tab: null,
  tagName: "li",
  classNames: ["tab"],

  urlMaxLength: 150,

  open: function(){
    var tab = this.get("tab");
    chrome.tabs.create({url: tab.url});
  },

  shortURL: function(){
    var max = this.get("urlMaxLength");
    var url = this.get("tab").url;
    return url.substring(0, max) + ((url.length > max)?"...":"");
  }.property("tab")
});

DTab.TabGroup = Ember.Object.extend({
  title: null,
  tabs: [],

  urls: function(){
    var i, buff = [], tabs = this.get("tabs");
    tabs.forEach(function(item){
      buff.push(item.url);
    });
    return buff;
  }.property("tabs"),

  log: function(){
    console.log(this.get("title"));
    var tabs = this.get("tabs");
    var i, len = tabs.length;
    for(i=0; i<len; i++){
      var tab = tabs[i];
      console.log("\t" + tab.title + "\n\t" + tab.url);
    }
  },

  open: function(windowId){
    var tabs = this.get("tabs");
    var i, count = tabs.length;
    for(i=0; i<count; i++){
      var tab = tabs[i];
      chrome.tabs.create({windowId: windowId, url: tab.url, pinned: tab.pinned});
    }
  },

  openInOwnWindow: function(){
    var group = this;
    chrome.windows.getCurrent(function(win){
      group.open(win.id);
    });
  },

  openInNewWindow: function(){
    var group = this;
    var urls = this.get("urls");
    //urls = ["http://www.google.com"];
    chrome.windows.create({focused: true, url: urls});
  }
});

DTab.TabGroupView = Ember.View.extend({
  templateName: "tabGroup",
  tagName: "div",
  classNames: ["tabGroup"],
  tabGroup: null,
  isCollapsed: true,
  alwaysTrue: true,

  isExpanded: function(){
    //This is so stupid
    return !(this.get("isCollapsed"));
  }.property("isCollapsed"),

  toggleCollapsed: function(){
    var isCollapsed = this.get("isCollapsed");
    this.set("isCollapsed", !isCollapsed);
  },

  openInOwnWindow: function(){
    this.get("tabGroup").openInOwnWindow();
  },

  openInNewWindow: function(){
    this.get("tabGroup").openInNewWindow();
  }
});

var tgview = DTab.TabGroupView.create();
console.log(tgview.get("alwaysTrue"));

DTab.TabGroupController = Ember.ArrayController.create({
  content: [],
  initFromLocalStorage: function(){
    var key;
    var content = this.get("content");
    for(key in localStorage){
      var data = JSON.parse(localStorage[key]);
      var group = DTab.TabGroup.create({title: key, tabs: data});
      content.push(group);
    }
  },
  log: function(){
    var content = this.get("content");
    var i, len = content.length;
    for(i=0; i<len; i++){
      content[i].log();
    }
  }

});

DTab.MainView = Ember.View.create({
  templateName: "mainView"
});

$(document).ready(function(){
  var tgc = DTab.TabGroupController
  tgc.initFromLocalStorage();
  tgc.log();
})
