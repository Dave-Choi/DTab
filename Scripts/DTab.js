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
    chrome.windows.create({focused: true, url: urls});
  }
});


DTab.TabGroupTitleView = Ember.View.extend({
  templateName: "tabGroupTitle",
  tagName: "h1",

  parentView: null,
  tabGroup: null
});


DTab.TabGroupTitlePrompt = Ember.TextField.extend({
  placeholder: "Name These Tabs",
  classNames: ["titlePrompt"],

  parentView: null,
  tabGroup: null
});


DTab.TabGroupView = Ember.View.extend({
  templateName: "tabGroup",
  tagName: "div",
  classNames: ["tabGroup"],
  tabGroup: null,
  titleView: null,
  isCollapsed: true,

  isExpanded: function(){
    //This is so stupid
    return !(this.get("isCollapsed"));
  }.property("isCollapsed"),

  toggleCollapsed: function(){
    var isCollapsed = this.get("isCollapsed");
    this.set("isCollapsed", !isCollapsed);
  }
});


DTab.TabGroupController = Ember.ArrayController.create({
  content: [],

  initCurrentWindowGroup: function(){
    var title = Ember.TextField.extend({});
    var currentGroup = DTab.TabGroup.create({});
    this.addObject(currentGroup);

    chrome.windows.getCurrent(function(win){
      chrome.tabs.getAllInWindow(win.id, function(tabs){
        currentGroup.set("tabs", tabs);
      });
    });
  },

  initFromLocalStorage: function(){
    for(var key in localStorage){
      var data = JSON.parse(localStorage[key]);
      var group = DTab.TabGroup.create({title: key, tabs: data});
      this.addObject(group);
    }
  },

  createNewGroup: function(){
    var group = DTab.TabGroup.create();
    this.addObject(group);
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
  var tgc = DTab.TabGroupController;
  tgc.initCurrentWindowGroup();
  tgc.initFromLocalStorage();
  tgc.log();
});