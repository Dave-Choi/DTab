DTab = Ember.Application.create({
	ready: function(){
		var cgc = DTab.CurrentGroupController;
		cgc.initCurrentWindowGroup();

		var tgc = DTab.TabGroupController;
		
		tgc.initFromLocalStorage();
		tgc.log();
	}

});


DTab.Tab = Ember.Object.extend({
	/*
		This class is intended to extend a chrome tab object.
		Mostly just used to observe the isTrashed property.
	*/
	isTrashed: false
});


DTab.TabView = Ember.View.extend({
	tab: null,
	trashDelegate: null,

	urlMaxLength: 150,
	classNameBindings: ["tab.isTrashed:trashed"],

	favIconUrl: function(){
		return this.get("tab").get("favIconUrl") || "Images/faviconFallback.png";
	}.property(),

	open: function(){
		var tab = this.get("tab");
		chrome.tabs.create({url: tab.url, pinned: tab.pinned});
	},

	shortURL: function(){
		var max = this.get("urlMaxLength");
		var url = this.get("tab").url;
		return url.substring(0, max) + ((url.length > max)?"...":"");
	}.property("tab.url"),

	trash: function(){
		var tab = this.get("tab");
		tab.set("isTrashed", true);
	},

	untrash: function(){
		var tab = this.get("tab");
		tab.set("isTrashed", false);
	},

	togglePinned: function(){
		var tab = this.get("tab");
		tab.set("pinned", !(tab.get("pinned")));
	}
});


DTab.TabViewMini = DTab.TabView.extend({
	templateName: "tabMini",
});


DTab.TabViewDetailed = DTab.TabView.extend({
	templateName: "tabDetailed",

	tagName: "li",
	classNames: ["tab"],
});


DTab.TabGroup = Ember.Object.extend({
	title: null,
	tabs: [],
	isTrashed: false,

	urls: function(){
		var i, buff = [], tabs = this.get("tabs");
		tabs.forEach(function(item){
			buff.push(item.url);
		});
		return buff;
	}.property("tabs.@each.url"),

	pinnedIndices: function(){
		//This is a shitty utility function that Chrome's broken behavior made me write
		var indices = [];
		var tabs = this.get("tabs");
		var i, len = tabs.length;

		for(i=0; i<len; i++){
			if(tabs[i].get("pinned")){
				indices.push(i);
			}
		}
		console.log(indices);
		return indices;
	},

	copyTabs: function(group){
		//To Do: check if instance of TabGroup, maybe don't copy the title
		var tabsCopy = group.get("tabs").copy();
		this.set("tabs", tabsCopy);
	},

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
		/*
			Near as I can tell, Chrome's callback timing on the chrome.windows.create function
			is inconsistent, so creating the window and then attempting to add tabs to it 
			in bulk after it's already created in the callback has inconsistent results.
			
			Feeding it a list of urls in is configuration object seems to consistently work, 
			but doesn't allow you to create them as pinned.

			Current implementation creates via a URL list and changes the appropriate tabs
			to pinned via the callback.  Really crappy hack until I come up with something better.
		*/
		var group = this;
		var urls = this.get("urls");
		var pinnedIndices = this.pinnedIndices();

		chrome.windows.create({focused: true, url: urls}, function(window){
			chrome.tabs.getAllInWindow(window.id, function(tabs){
				var i, len = pinnedIndices.length;
				for(i=0; i<len; i++){
					var tab = tabs[i];
					console.log(tabs[i]);
					chrome.tabs.update(tab.id, {pinned: true});
				}
			});
		});
	},

	loadFromLocalStorage: function(){
		var data = localStorage[this.get("title")];
		if(data){
			var tabs = JSON.parse(data);
			var i, len = tabs.length;
			for(i=0; i<len; i++){
				var tab = tabs[i];
				tabs[i] = DTab.Tab.create(tab);
			}
			this.set("tabs", tabs);
		}
	},

	saveToLocalStorage: function(){
		var data = JSON.stringify(this.get("tabs"));
		localStorage[this.get("title")] = data;
	},

	removeFromLocalStorage: function(){
		if(localStorage[this.get("title")]){
			delete localStorage[this.get("title")];
		}
	},

	isStored: function(){
		var data = localStorage[this.get("title")];
		if(data){
			return true;
		}
		return false;
	}.property(),

	update: function(){
		if(this.get("isStored")){
			this.saveToLocalStorage();
		}
	},

	rename: function(newName){
		this.removeFromLocalStorage();
		this.set("title", newName);
		this.saveToLocalStorage();
	},

	trash: function(){
		this.set("isTrashed", true);
		this.removeFromLocalStorage();
	},

	untrash: function(){
		this.set("isTrashed", false);
		this.saveToLocalStorage();
	},

	removeTrashed: function(){
		//Don't rerender if nothing's trashed
		var notTrashedTabs = this.get("tabs").filterProperty("isTrashed", false);
		if(this.get("tabs").length != notTrashedTabs.length){
			this.set("tabs", this.get("tabs").filterProperty("isTrashed", false));
			this.update();
		}
	},

	pinnedChanged: function(){
		console.log("pinned changed");
		this.update();
	}.observes("tabs.@each.pinned")

});


DTab.LiveTabGroup = DTab.TabGroup.extend({
	window: null,
	subscriptions: [chrome.tabs.onUpdated, chrome.tabs.onMoved, chrome.tabs.onAttached, chrome.tabs.onDetached, chrome.tabs.onRemoved],

	loadFromWindow: function(){
		var thisGroup = this;
		var window = this.get("window");

		chrome.tabs.getAllInWindow(window.id, function(tabs){
			var tabsBuff = [];
			var i, len = tabs.length;
			for(i=0; i<len; i++){
				var tab = tabs[i];
				tabsBuff[i] = DTab.Tab.create(tab);
			}
			thisGroup.set("tabs", tabsBuff);
		});
	},

	listenForUpdates: function(){
		var window = this.get("window");
		var thisGroup = this;
		var subscriptions = this.get("subscriptions");

		subscriptions.forEach(function(item, index, self){
			item.addListener(function(){
				thisGroup.loadFromWindow();
			});
		});
	},

	initWithWindow: function(window){
		this.set("window", window);
		this.loadFromWindow();
		this.listenForUpdates();
	},

	initWithCurrentWindow: function(){
		var thisGroup = this;
		chrome.windows.getCurrent(function(win){
			thisGroup.initWithWindow(win);
		});
	}
});


DTab.TabGroupTitleView = Ember.View.extend({
	templateName: "tabGroupTitle",
	tagName: "div",

	parentView: null,
	tabGroup: null
});


DTab.TabGroupTitlePrompt = Ember.TextField.extend({
	placeholder: "Name These Tabs",
	classNames: ["titlePrompt"],

	parentView: null,
	tabGroup: null,

	insertNewline: function(){
		var value = this.get("value");
		var tabGroup = this.get("tabGroup");

		if(value){
			//tabGroup.set("title", value);
			tabGroup.rename(value);
			console.log(this.get("parentView").get("isEditing"));
			this.get("parentView").set("isEditing", false);

		}
	},

	didInsertElement: function(){
		this.$().focus();
	}
});


DTab.TabGroupView = Ember.View.extend({
	templateName: "tabGroup",
	tagName: "div",
	classNames: ["tabGroup"],
	tabGroup: null,
	isCollapsed: true,
	isEditing: false,
	
	titleView: function(){
		var isEditing = this.get("isEditing");
		var needsTitle = false;
		var tabGroup = this.get("tabGroup");
		if(tabGroup){
			needsTitle = (tabGroup.get("title") == null);
		}
		var titleViewClass = DTab.TabGroupTitleView;
		if(isEditing || needsTitle){
			titleViewClass = DTab.TabGroupTitlePrompt;
		}
		return titleViewClass.extend({
			parentView: this,
			tabGroup: tabGroup,
			value: tabGroup.get("title")
		});
	}.property("tabGroup.title", "isEditing"),

	titleViewChanged: function(){
		this.rerender();
	}.observes("titleView"),

	isExpanded: function(){
		//This is so stupid
		return !(this.get("isCollapsed"));
	}.property("isCollapsed"),

	toggleCollapsed: function(){
		var isCollapsed = this.get("isCollapsed");
		this.set("isCollapsed", !isCollapsed);
	},

	rename: function(){
		console.log("rename from TabGroupView");
		this.set("isEditing", true);
	},

	trashedChanged: function(){
		var tabGroup = this.get("tabGroup");
		if(tabGroup.get("isTrashed")){
			this.$().addClass("trashed");
		}
		else{
			this.$().removeClass("trashed");
		}
	}.observes("tabGroup.isTrashed"),

	tabTrashedChanged: function(obj, keyName, value){
		var group = this.get("tabGroup");
		group.update();
	}.observes("tabGroup.tabs.@each.isTrashed")
});


DTab.TabGroupController = Ember.ArrayProxy.create({
	content: [],

	initFromLocalStorage: function(){
		for(var key in localStorage){
			var group = DTab.TabGroup.create({title: key});
			group.loadFromLocalStorage();
			this.addObject(group);
		}
	},

	createNewGroup: function(){
		var group = DTab.TabGroup.create();
		//var content = this.get("content");
		this.unshiftObject(group);
	},

	addGroup: function(group){
		this.unshiftObject(group);
	},

	log: function(){
		var content = this.get("content");
		var i, len = content.length;
		for(i=0; i<len; i++){
			content[i].log();
		}
	},

	removeTrashed: function(){
		var content = this.get("content");
		content.filterProperty("isTrashed", true).forEach(this.removeObject, this);
		content.forEach(function(item){
			item.removeTrashed();
		});
	}
});


DTab.TrashItem = Ember.Object.extend({
	item: null,
	source: null, //Maybe not necessary?

	undoMethod: function(){
		return;
	}
});


DTab.CurrentGroupTitlePrompt = Ember.TextField.extend({
	placeholder: "Name This Window's Tabs",
	classNames: ["titlePrompt"],

	parentView: null,
	tabGroup: null,

	insertNewline: function(){
		//Clone this group, add to main list.
		var value = this.get("value");
		if(value){
			DTab.CurrentGroupController.saveGroup(value);
			this.set("value", null);
		}
	}
});


DTab.CurrentGroupView = DTab.TabGroupView.extend({
	tabGroup: null,
	titleView: function(){
		var tabGroup = this.get("tabGroup");
		return DTab.CurrentGroupTitlePrompt.extend({tabGroup: tabGroup});
	}.property()
});


DTab.CurrentGroupController = Ember.ArrayController.create({
	content: [],

	refreshGroup: function(){
		var currentGroup = this.objectAtContent(0);
		currentGroup.loadFromCurrentWindow();
	},

	initCurrentWindowGroup: function(){
		this.clear();
		var currentGroup = DTab.LiveTabGroup.create();
		currentGroup.initWithCurrentWindow();
		this.addObject(currentGroup);
	},

	saveGroup: function(title){
		var target = localStorage[title];
		if(target){
			//Confirm overwrite
		}
		else{
			var tabGroup = this.objectAtContent(0);
			tabGroup.removeTrashed();

			var groupCopy = DTab.TabGroup.create();
			groupCopy.copyTabs(tabGroup);
			groupCopy.rename(title);
			DTab.TabGroupController.addGroup(groupCopy);

			this.initCurrentWindowGroup();
		}
	}
});


DTab.MainControlsView = Ember.View.extend({
	templateName: "mainControls"
});


DTab.MainView = Ember.View.extend({
	templateName: "mainView"
});