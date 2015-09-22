import Ember from 'ember';
import IssueSubscriptions from "app/mixins/subscriptions/issue";
import Messaging from "app/mixins/messaging";

var IssueController = Ember.Controller.extend(
  IssueSubscriptions, Messaging, {
  needs: ["application"],
  //Fix the need to delay event subscriptions
  subscribeDisabled: true,

  isCollaborator: function(){
    return this.get("model.data.repo.is_collaborator");
  }.property("model.data.repo.is_collaborator"),
  columns: Ember.computed.alias("controllers.application.model.board.columns"),
  isReady: function(key, value){
    if(value !== undefined) {
      if(value) {
        this.set("model.customState", "ready");
        return true; 
      } else {
        this.set("model.customState", "");
        return false;
      }
    } else {
      return this.get("model.customState") === "ready";
    }
  }.property("model.customState", "model.data._data.custom_state"),
  isBlocked: function(key, value){
    if(value !== undefined) {
      if(value) {
        this.set("model.customState", "blocked");
        return true;
      } else {
        this.set("model.customState", "");
        return false;
      }
      return;
    } else {
      return this.get("model.customState") === "blocked";
    }
  }.property("model.customState", "model.data._data.custom_state"),
  isClosed: function(){
    return this.get("model.data.state") === "closed";
  }.property("model.data.state"),
  actions: {
    labelsChanged: function () {
       Ember.run.once(function () {
         this.get("model").updateLabels();
       }.bind(this));
    },
    assignUser: function(login){
      return this.get("model").assignUser(login);
    },
    assignMilestone: function(milestone) {
      this.get("model").assignMilestone(this.get("model.data.number"), milestone);
    },
    submitComment: function () {
      if (this.get("processing") || this.get("isEmpty")) { 
        return; 
      }
      var comments = this.get("model.data.activities.comments");

      this.set("processing", true);

      this.get("model").submitComment(this.get("commentBody"))
        .then(function(comment){
          comments.pushObject(comment);

         Ember.run.once(function () {
            this.set("commentBody", "");
            this.set("processing", false);
         }.bind(this));

          return comment;
         }.bind(this));
    },
    close: function(){
      var _self = this;
      this.set("processing", true);
      this.get("model").closeAndMove().then(function(response){
        var channel = _self.hbsubscriptions.channel;
        var topic = "issues.{model.data.number}.closed_and_moved";
        _self.publish(channel, topic, {issue: response});
        _self.set("processing", false);
      });

      if (this.get("commentBody")){ this.send("submitComment"); }
    },
    reopenCard: function(){
      var _self = this;
      this.set("processing", true);
      this.get("model").reopenIssue().then(function(response){
        var channel = _self.hbsubscriptions.channel;
        var topic = "issues.{model.data.number}.issue_reopened";
        _self.publish(channel, topic, {issue: response});
        _self.set("processing", false);
      });

      if (this.get("commentBody")){ this.send("submitComment"); }
    }
  },
  commentBody: null,
  isEmpty: function(){
    return Ember.isBlank(this.get('commentBody'));
  }.property('commentBody'),
  isValid: function () {
    return this.get("commentBody");
  }.property("commentBody"),
  disabled: function () {
      return this.get("processing") || !this.get("isValid") || this.get('isEmpty');
  }.property("processing","isValid"),
  _events : function () {
     var events = this.get("model.data.activities.events");
     return events.map(function (e){return _.extend(e, {type: "event" }); });
  }.property("model.data.activities.events.[]"),
  _comments : function () {
     var comments = this.get("model.data.activities.comments");
     return comments.map(function (e){ return _.extend(e, {type: "comment" }); });
  }.property("model.data.activities.comments.[]"),
  allActivities: Ember.computed.union("model.data.activities.{comments,events}"),
  activitiesSort:["created_at"],
  sortedActivities: Ember.computed.sort("allActivities", "activitiesSort"),
  mentions: function (){
    var union = _.union(this.get('model.repo.assignees.[]'),this.get('allActivities').mapBy('user'));
    return _.uniq(_.compact(union), function(i){
      return i.login;
    });
  }.property('model.repo.assignees.[]','allActivities')
});

export default IssueController;
