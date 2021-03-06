//     Create.js 1.0.0alpha4 - On-site web editing interface
//     (c) 2011-2012 Henri Bergius, IKS Consortium
//     Create may be freely distributed under the MIT license.
//     For all details and documentation:
//     http://createjs.org/

(function (jQuery, undefined) {
  // Run JavaScript in strict mode
  /*global jQuery:false _:false window:false VIE:false */
  'use strict';

  // # Create main widget
  //
  // The `midgardCreate` widget is the main entry point into using
  // Create for editing content.
  //
  // While most individual Create widgets can also be used separately,
  // the most common use case is to instantiate `midgardCreate` for
  // your pages and let it handle editables, toolbars, and storate.
  //
  //     jQuery('body').midgardCreate();
  jQuery.widget('Midgard.midgardCreate', {
    // ## Configuration
    //
    // Like most jQuery UI widgets, Create accepts various options 
    // when being instantiated.
    options: {
      // Initial toolbar rendering style: `full` or `minimized`.
      toolbar: 'full',
      // The *Save* jQuery UI button instance.
      saveButton: null,
      // Initial usage state: `browse` or `edit`
      state: 'browse',
      // Whether to highlight editable elements when entering `edit`
      // state.
      highlight: true,
      // Color for the highlights.
      highlightColor: '#67cc08',
      // Widgets to use for editing various content types.
      editorWidgets: {
        'default': 'hallo' 
      },
      // Additional editor options.
      editorOptions: {
        hallo: {
          widget: 'halloWidget'
        }
      },
      // Widgets to use for managing collections.
      collectionWidgets: {
        'default': 'midgardCollectionAdd'
      },
      // URL callback used with Backbone.sync. Will be passed to the
      // Storage widget.
      url: function () {},
      // Prefix used for localStorage.
      storagePrefix: 'node',
      // Workflow configuration. URL callback is used for retrieving
      // list of workflow actions that can be initiated for an item.
      workflows: {
        url: null
      },
      // Notifications configuration.
      notifications: {},
      // VIE instance used with Create.js. If no VIE instance is passed,
      // Create.js will create its own instance.
      vie: null,
      // URL for the Apache Stanbol service used for annotations, and tag
      // and image suggestions.
      stanbolUrl: null,
      // URL for the DBpedia instance used for finding more information
      // about annotations and tags.
      dbPediaUrl: null,
      // Whether to enable the Tags widget.
      tags: false,
      // Selector for element where Create.js will place its buttons, like
      // Save and Edit/Cancel.
      buttonContainer: '.create-ui-toolbar-statustoolarea .create-ui-statustools',
      // Templates used for UI elements of the Create widget
      templates: {
        buttonContent: '<%= label %> <i class="icon-<%= icon %>"></i>',
        button: '<li id="<%= id %>"><a class="create-ui-btn"><%= buttonContent %></a></li>'
      },
      // Localization callback function. Will be run in the widget context.
      // Override to connect Create.js with your own localization system
      localize: function (id, language) {
        return window.midgardCreate.localize(id, language);
      },
      // Language used for Create.js. Will be retrieved from page lang attrib
      // if left blank
      language: null
    },

    _create: function () {
      this.vie = this._setupVIE(this.options);

      var widget = this;
      window.setTimeout(function () {
        widget._checkSession();
      }, 10);

      if (!this.options.language) {
        this.options.language = jQuery('html').attr('lang');
      }

      this._enableToolbar();
      this._saveButton();
      this._editButton();
      this._prepareStorage();

      if (this.element.midgardWorkflows) {
        this.element.midgardWorkflows(this.options.workflows);
      }

      if (this.element.midgardNotifications) {
        this.element.midgardNotifications(this.options.notifications);
      }
    },

    destroy: function () {
      // Clean up on widget destruction
      this.element.midgardStorage('destroy');
      this.element.midgardToolbar('destroy');

      jQuery('[about]', this.element).each(function () {
        jQuery(this).midgardEditable('destroy');
      });

      // Conditional widgets
      if (this.element.midgardWorkflows) {
        this.element.midgardWorkflows('destroy');
      }
      if (this.element.midgardNotifications) {
        this.element.midgardNotifications('destroy');
      }
      if (this.options.tags) {
        this.element.midgardTags('destroy');
      }
      // TODO: use _destroy in jQuery UI 1.9 and above
      jQuery.Widget.prototype.destroy.call(this);
    },

    _setupVIE: function (options) {
      var vie;
      if (options.vie) {
        vie = options.vie;
      } else {
        // Set up our own VIE instance
        vie = new VIE();
      }

      if (!vie.hasService('rdfa')) {
        vie.use(new vie.RdfaService());
      }

      if (!vie.hasService('stanbol') && options.stanbolUrl) {
        vie.use(new vie.StanbolService({
          proxyDisabled: true,
          url: options.stanbolUrl
        }));
      }

      if (!vie.hasService('dbpedia') && options.dbPediaUrl) {
        vie.use(new vie.DBPediaService({
          proxyDisabled: true,
          url: options.dbPediaUrl
        }));
      }

      return vie;
    },

    _prepareStorage: function () {
      this.element.midgardStorage({
        vie: this.vie,
        url: this.options.url,
        localize: this.options.localize,
        language: this.options.language
      });

      var widget = this;
      this.element.bind('midgardstoragesave', function () {
        jQuery('#midgardcreate-save a').html(_.template(widget.options.templates.buttonContent, {
          label: widget.options.localize('Saving', widget.options.language),
          icon: 'upload'
        }));
      });

      this.element.bind('midgardstoragesaved midgardstorageerror', function () {
        jQuery('#midgardcreate-save a').html(_.template(widget.options.templates.buttonContent, {
          label: widget.options.localize('Save', widget.options.language),
          icon: 'ok'
        }));
      });
    },

    _init: function () {
      this.setState(this.options.state);

      // jQuery(this.element).data('midgardNotifications').showTutorial();
    },

    setState: function (state) {
      this._setOption('state', state);
      if (state === 'edit') {
        this._enableEdit();
      } else {
        this._disableEdit();
      }
      this._setEditButtonState(state);
    },

    setToolbar: function (state) {
      this.options.toolbar = state;
      this.element.midgardToolbar('setDisplay', state);
    },

    showNotification: function (options) {
      if (this.element.midgardNotifications) {
        return this.element.midgardNotifications('create', options);
      }
    },

    configureEditor: function (name, widget, options) {
      this.options.editorOptions[name] = {
        widget: widget,
        options: options
      };
    },

    setEditorForContentType: function (type, editor) {
      if (this.options.editorOptions[editor] === undefined && editor !== null) {
        throw new Error("No editor " + editor + " configured");
      }
      this.options.editorWidgets[type] = editor;
    },

    setEditorForProperty: function (property, editor) {
      if (this.options.editorOptions[editor] === undefined && editor !== null) {
        throw new Error("No editor " + editor + " configured");
      }
      this.options.editorWidgets[property] = editor;
    },

    _checkSession: function () {
      if (!window.sessionStorage) {
        return;
      }

      var toolbarID = this.options.storagePrefix + 'Midgard.create.toolbar';
      if (window.sessionStorage.getItem(toolbarID)) {
        this.setToolbar(window.sessionStorage.getItem(toolbarID));
      }

      var stateID = this.options.storagePrefix + 'Midgard.create.state';
      if (window.sessionStorage.getItem(stateID)) {
        this.setState(window.sessionStorage.getItem(stateID));
      }

      this.element.bind('midgardcreatestatechange', function (event, options) {
        window.sessionStorage.setItem(stateID, options.state);
      });
    },

    _saveButton: function () {
      if (this.options.saveButton) {
        return this.options.saveButton;
      }
      var widget = this;
      jQuery(this.options.buttonContainer, this.element).append(jQuery(_.template(this.options.templates.button, {
        id: 'midgardcreate-save',
        buttonContent: _.template(this.options.templates.buttonContent, {
          label: widget.options.localize('Save', widget.options.language),
          icon: 'ok'
        })
      })));
      this.options.saveButton = jQuery('#midgardcreate-save', this.element);
      this.options.saveButton.hide();
      return this.options.saveButton;
    },

    _editButton: function () {
      var widget = this;
      jQuery(this.options.buttonContainer, this.element).append(jQuery(_.template(this.options.templates.button, {
        id: 'midgardcreate-edit',
        buttonContent: ''
      })));
      jQuery('#midgardcreate-edit', this.element).bind('click', function () {
        if (widget.options.state === 'edit') {
          widget.setState('browse');
          return;
        }
        widget.setState('edit');
      });
    },

    _setEditButtonState: function (state) {
      var widget = this;
      var buttonContents = {
        edit: _.template(this.options.templates.buttonContent, {
          label: widget.options.localize('Cancel', widget.options.language),
          icon: 'remove'
        }),
        browse: _.template(this.options.templates.buttonContent, {
          label: widget.options.localize('Edit', widget.options.language),
          icon: 'edit'
        })
      };
      var editButton = jQuery('#midgardcreate-edit a', this.element);
      if (!editButton) {
        return;
      }
      if (state === 'edit') {
        editButton.addClass('selected');
      }
      editButton.html(buttonContents[state]);
    },

    _enableToolbar: function () {
      var widget = this;
      this.element.bind('midgardtoolbarstatechange', function (event, options) {
        widget.setToolbar(options.display);
        if (window.sessionStorage) {
          window.sessionStorage.setItem(widget.options.storagePrefix + 'Midgard.create.toolbar', options.display);
        }
      });

      this.element.midgardToolbar({
        display: this.options.toolbar,
        vie: this.vie
      });
    },

    _enableEdit: function () {
      this._setOption('state', 'edit');
      var widget = this;
      var editableOptions = {
        toolbarState: widget.options.toolbar,
        disabled: false,
        vie: widget.vie,
        widgets: widget.options.editorWidgets,
        editors: widget.options.editorOptions,
        collectionWidgets: widget.options.collectionWidgets,
        localize: widget.options.localize,
        language: widget.options.language
      };
      if (widget.options.enableEditor) {
        editableOptions.enableEditor = widget.options.enableEditor;
      }
      if (widget.options.disableEditor) {
        editableOptions.disableEditor = widget.options.disableEditor;
      }
      jQuery('[about]', this.element).each(function () {
        var element = this;
        if (widget.options.highlight) {
          var highlightEditable = function (event, options) {
              if (!jQuery(options.element).is(':visible')) {
                // Hidden element, don't highlight
                return;
              }
              if (options.entityElement.get(0) !== element) {
                // Propagated event from another entity, ignore
                return;
              }

              // Ensure other animations are stopped before proceeding
              options.element.stop(true, true);

              // Highlight the editable
              options.element.effect('highlight', {
                color: widget.options.highlightColor
              }, 3000);
            };

          jQuery(this).bind('midgardeditableenableproperty', highlightEditable);
        }
        jQuery(this).bind('midgardeditabledisable', function () {
          jQuery(this).unbind('midgardeditableenableproperty', highlightEditable);
        });

        if (widget.options.tags) {
          jQuery(this).bind('midgardeditableenable', function (event, options) {
            if (event.target !== element) {
              return;
            }
            jQuery(this).midgardTags({
              vie: widget.vie,
              entityElement: options.entityElement,
              entity: options.instance,
              localize: widget.options.localize,
              language: widget.options.language
            });
          });
        }

        jQuery(this).midgardEditable(editableOptions);
      });

      this._trigger('statechange', null, {
        state: 'edit'
      });
    },

    _disableEdit: function () {
      var widget = this;
      var editableOptions = {
        disabled: true,
        vie: widget.vie,
        editorOptions: widget.options.editorOptions,
        localize: widget.options.localize,
        language: widget.options.language
      };
      jQuery('[about]', this.element).each(function () {
        jQuery(this).midgardEditable(editableOptions);
        jQuery(this).removeClass('ui-state-disabled');
      });
      this._setOption('state', 'browse');
      this._trigger('statechange', null, {
        state: 'browse'
      });
    }
  });
})(jQuery);
//     Create.js - On-site web editing interface
//     (c) 2011-2012 Henri Bergius, IKS Consortium
//     Create may be freely distributed under the MIT license.
//     For all details and documentation:
//     http://createjs.org/
(function (jQuery, undefined) {
  // Run JavaScript in strict mode
  /*global jQuery:false _:false window:false console:false */
  'use strict';

  // # Widget for adding items to a collection
  jQuery.widget('Midgard.midgardCollectionAdd', {
    options: {
      editingWidgets: null,
      collection: null,
      model: null,
      definition: null,
      view: null,
      disabled: false,
      vie: null,
      editableOptions: null,
      templates: {
        button: '<button class="btn"><i class="icon-<%= icon %>"></i> <%= label %></button>'
      }
    },

    _create: function () {
      this.addButtons = [];
      var widget = this;
      if (!widget.options.collection.localStorage) {
        try {
          widget.options.collection.url = widget.options.model.url();
        } catch (e) {
          if (window.console) {
            console.log(e);
          }
        }
      }

      widget.options.collection.bind('add', function (model) {
        model.primaryCollection = widget.options.collection;
        widget.options.vie.entities.add(model);
        model.collection = widget.options.collection;
      });

      // Re-check collection constraints
      widget.options.collection.bind('add remove reset', widget.checkCollectionConstraints, widget);

      widget._bindCollectionView(widget.options.view);
    },

    _bindCollectionView: function (view) {
      var widget = this;
      view.bind('add', function (itemView) {
        itemView.$el.effect('slide', function () {
          widget._makeEditable(itemView);
        });
      });
    },

    _makeEditable: function (itemView) {
      this.options.editableOptions.disabled = this.options.disabled;
      this.options.editableOptions.model = itemView.model;
      itemView.$el.midgardEditable(this.options.editableOptions);
    },

    _init: function () {
      if (this.options.disabled) {
        this.disable();
        return;
      }
      this.enable();
    },

    hideButtons: function () {
      _.each(this.addButtons, function (button) {
        button.hide();
      });
    },

    showButtons: function () {
      _.each(this.addButtons, function (button) {
        button.show();
      });
    },

    checkCollectionConstraints: function () {
      if (this.options.disabled) {
        return;
      }

      if (!this.options.view.canAdd()) {
        this.hideButtons();
        return;
      }

      if (!this.options.definition) {
        // We have now information on the constraints applying to this collection
        this.showButtons();
        return;
      }

      if (!this.options.definition.max || this.options.definition.max === -1) {
        // No maximum constraint
        this.showButtons();
        return;
      }

      if (this.options.collection.length < this.options.definition.max) {
        this.showButtons();
        return;
      }
      // Collection is already full by its definition
      this.hideButtons();
    },

    enable: function () {
      var widget = this;

      var addButton = jQuery(_.template(this.options.templates.button, {
        icon: 'plus',
        label: this.options.editableOptions.localize('Add', this.options.editableOptions.language)
      })).button();
      addButton.addClass('midgard-create-add');
      addButton.click(function () {
        widget.addItem(addButton);
      });
      jQuery(widget.options.view.el).after(addButton);

      widget.addButtons.push(addButton);
      widget.checkCollectionConstraints();
    },

    disable: function () {
      _.each(this.addButtons, function (button) {
        button.remove();
      });
      this.addButtons = [];
    },

    _getTypeActions: function (options) {
      var widget = this;
      var actions = [];
      _.each(this.options.definition.range, function (type) {
        var nsType = widget.options.collection.vie.namespaces.uri(type);
        if (!widget.options.view.canAdd(nsType)) {
          return;
        }
        actions.push({
          name: type,
          label: type,
          cb: function () {
            widget.options.collection.add({
              '@type': type
            }, options);
          },
          className: 'create-ui-btn'
        });
      });
      return actions;
    },

    addItem: function (button, options) {
      var itemData = {};
      if (this.options.definition && this.options.definition.range) {
        if (this.options.definition.range.length === 1) {
          // Items can be of single type, add that
          itemData['@type'] = this.options.definition.range[0];
        } else {
          // Ask user which type to add
          jQuery('body').midgardNotifications('create', {
            bindTo: button,
            gravity: 'L',
            body: this.options.editableOptions.localize('Choose type to add', this.options.editableOptions.language),
            timeout: 0,
            actions: this._getTypeActions(options)
          });
          return;
        }
      }
      this.options.collection.add({}, options);
    }
  });
})(jQuery);
//     Create.js - On-site web editing interface
//     (c) 2011-2012 Henri Bergius, IKS Consortium
//     Create may be freely distributed under the MIT license.
//     For all details and documentation:
//     http://createjs.org/
(function (jQuery, undefined) {
  // Run JavaScript in strict mode
  /*global jQuery:false _:false window:false console:false */
  'use strict';

  // # Widget for adding items anywhere inside a collection
  jQuery.widget('Midgard.midgardCollectionAddBetween', jQuery.Midgard.midgardCollectionAdd, {
    _bindCollectionView: function (view) {
      var widget = this;
      view.bind('add', function (itemView) {
        //itemView.el.effect('slide');
        widget._makeEditable(itemView);
        widget._refreshButtons();
      });
      view.bind('remove', function () {
        widget._refreshButtons();
      });
    },

    _refreshButtons: function () {
      var widget = this;
      window.setTimeout(function () {
        widget.disable();
        widget.enable();
      }, 1);
    },

    prepareButton: function (index) {
      var widget = this;
      var addButton = jQuery(_.template(this.options.templates.button, {
        icon: 'plus',
        label: ''
      })).button();
      addButton.addClass('midgard-create-add');
      addButton.click(function () {
        widget.addItem(addButton, {
          at: index
        });
      });
      return addButton;
    },

    enable: function () {
      var widget = this;

      var firstAddButton = widget.prepareButton(0);
      jQuery(widget.options.view.el).prepend(firstAddButton);
      widget.addButtons.push(firstAddButton);
      jQuery.each(widget.options.view.entityViews, function (cid, view) {
        var index = widget.options.collection.indexOf(view.model);
        var addButton = widget.prepareButton(index + 1);
        jQuery(view.el).append(addButton);
        widget.addButtons.push(addButton);
      });

      this.checkCollectionConstraints();
    },

    disable: function () {
      var widget = this;
      jQuery.each(widget.addButtons, function (idx, button) {
        button.remove();
      });
      widget.addButtons = [];
    }
  });
})(jQuery);
//     Create.js - On-site web editing interface
//     (c) 2011-2012 Henri Bergius, IKS Consortium
//     Create may be freely distributed under the MIT license.
//     For all details and documentation:
//     http://createjs.org/
(function (jQuery, undefined) {
  // Run JavaScript in strict mode
  /*global jQuery:false _:false window:false VIE:false */
  'use strict';

  // # Create editing widget
  jQuery.widget('Midgard.midgardEditable', {
    options: {
      editables: [],
      collections: [],
      model: null,
      editors: {
        hallo: {
          widget: 'halloWidget',
          options: {}
        }
      },
      // the available widgets by data type
      widgets: {
        'default': 'hallo'
      },
      collectionWidgets: {
        'default': 'midgardCollectionAdd'
      },
      toolbarState: 'full',
      vie: null,
      disabled: false,
      localize: function (id, language) {
        return window.midgardCreate.localize(id, language);
      },
      language: null
    },

    _create: function () {
      this.vie = this.options.vie;
      if (!this.options.model) {
        var widget = this;
        this.vie.load({element: this.element}).from('rdfa').execute().done(function (entities) {
          widget.options.model = entities[0];
        });
      }
    },

    _init: function () {
      if (this.options.disabled) {
        this.disable();
        return;
      }
      this.enable();
    },

    findEditableElements: function (callback) {
      this.vie.service('rdfa').findPredicateElements(this.options.model.id, jQuery('[property]', this.element), false).each(callback);
    },

    enable: function () {
      var widget = this;
      if (!this.options.model) {
        return;
      }

      this.findEditableElements(function () {
        return widget._enableProperty(jQuery(this));
      });

      this._trigger('enable', null, {
        instance: this.options.model,
        entityElement: this.element
      });

      if (!this.vie.services.rdfa) {
        return;
      }

      _.each(this.vie.service('rdfa').views, function (view) {
        if (view instanceof widget.vie.view.Collection && widget.options.model === view.owner) {
          var property = view.collection.predicate;
          var collection = widget.enableCollection({
            model: widget.options.model,
            collection: view.collection,
            property: property,
            definition: widget.getAttributeDefinition(property),
            view: view,
            element: view.el,
            vie: widget.vie,
            editableOptions: widget.options
          });
          widget.options.collections.push(collection);
        }
      });
    },

    disable: function () {
      var widget = this;
      jQuery.each(this.options.editables, function (index, editable) {
        widget.disableEditor({
          widget: widget,
          editable: editable,
          entity: widget.options.model,
          element: jQuery(this)
        });
      });
      this.options.editables = [];
      jQuery.each(this.options.collections, function (index, collectionWidget) {
        widget.disableCollection({
          widget: widget,
          model: widget.options.model,
          element: collectionWidget,
          vie: widget.vie,
          editableOptions: widget.options
        });
      });
      this.options.collections = [];

      this._trigger('disable', null, {
        instance: this.options.model,
        entityElement: this.element
      });
    },

    getElementPredicate: function (element) {
      return this.vie.service('rdfa').getElementPredicate(element);
    },

    _enableProperty: function (element) {
      var widget = this;
      var propertyName = this.getElementPredicate(element);
      if (!propertyName) {
        return true;
      }
      if (this.options.model.get(propertyName) instanceof Array) {
        // For now we don't deal with multivalued properties in the editable
        return true;
      }

      var editable = this.enableEditor({
        widget: this,
        element: element,
        entity: this.options.model,
        property: propertyName,
        vie: this.vie,
        modified: function (content) {
          var changedProperties = {};
          changedProperties[propertyName] = content;
          widget.options.model.set(changedProperties, {
            silent: true
          });
          widget._trigger('changed', null, {
            property: propertyName,
            instance: widget.options.model,
            element: element,
            entityElement: widget.element
          });
        },
        activated: function () {
          widget._trigger('activated', null, {
            property: propertyName,
            instance: widget.options.model,
            element: element,
            entityElement: widget.element
          });
        },
        deactivated: function () {
          widget._trigger('deactivated', null, {
            property: propertyName,
            instance: widget.options.model,
            element: element,
            entityElement: widget.element
          });
        }
      });

      if (editable) {
        this._trigger('enableproperty', null, {
          editable: editable,
          property: propertyName,
          instance: this.options.model,
          element: element,
          entityElement: this.element
        });
      }

      this.options.editables.push(editable);
    },

    // returns the name of the widget to use for the given property
    _editorName: function (data) {
      if (this.options.widgets[data.property] !== undefined) {
        // Widget configuration set for specific RDF predicate
        return this.options.widgets[data.property];
      }

      // Load the widget configuration for the data type
      var propertyType = 'default';
      var attributeDefinition = this.getAttributeDefinition(data.property);
      if (attributeDefinition) {
        propertyType = attributeDefinition.range[0];
      }
      if (this.options.widgets[propertyType] !== undefined) {
        return this.options.widgets[propertyType];
      }
      return this.options.widgets['default'];
    },

    _editorWidget: function (editor) {
      return this.options.editors[editor].widget;
    },

    _editorOptions: function (editor) {
      return this.options.editors[editor].options;
    },

    getAttributeDefinition: function (property) {
      var type = this.options.model.get('@type');
      if (!type) {
        return;
      }
      if (!type.attributes) {
        return;
      }
      return type.attributes.get(property);
    },

    enableEditor: function (data) {
      var editorName = this._editorName(data);
      if (editorName === null) {
        return;
      }

      var editorWidget = this._editorWidget(editorName);

      data.editorOptions = this._editorOptions(editorName);
      data.toolbarState = this.options.toolbarState;
      data.disabled = false;

      if (typeof jQuery(data.element)[editorWidget] !== 'function') {
        throw new Error(editorWidget + ' widget is not available');
      }

      jQuery(data.element)[editorWidget](data);
      jQuery(data.element).data('createWidgetName', editorWidget);
      return jQuery(data.element);
    },

    disableEditor: function (data) {
      var widgetName = jQuery(data.element).data('createWidgetName');

      data.disabled = true;

      if (widgetName) {
        // only if there has been an editing widget registered
        jQuery(data.element)[widgetName](data);
        jQuery(data.element).removeClass('ui-state-disabled');
      }
    },

    collectionWidgetName: function (data) {
      if (this.options.collectionWidgets[data.property] !== undefined) {
        // Widget configuration set for specific RDF predicate
        return this.options.collectionWidgets[data.property];
      }

      var propertyType = 'default';
      var attributeDefinition = this.getAttributeDefinition(data.property);
      if (attributeDefinition) {
        propertyType = attributeDefinition.range[0];
      }
      if (this.options.collectionWidgets[propertyType] !== undefined) {
        return this.options.collectionWidgets[propertyType];
      }
      return this.options.collectionWidgets['default'];
    },

    enableCollection: function (data) {
      var widgetName = this.collectionWidgetName(data);
      if (widgetName === null) {
        return;
      }
      data.disabled = false;
      if (typeof jQuery(data.element)[widgetName] !== 'function') {
        throw new Error(widgetName + ' widget is not available');
      }
      jQuery(data.element)[widgetName](data);
      jQuery(data.element).data('createCollectionWidgetName', widgetName);
      return jQuery(data.element);
    },

    disableCollection: function (data) {
      var widgetName = jQuery(data.element).data('createCollectionWidgetName');
      if (widgetName === null) {
        return;
      }
      data.disabled = true;
      if (widgetName) {
        // only if there has been an editing widget registered
        jQuery(data.element)[widgetName](data);
        jQuery(data.element).removeClass('ui-state-disabled');
      }
    }
  });
})(jQuery);
//     Create.js - On-site web editing interface
//     (c) 2012 Tobias Herrmann, IKS Consortium
//     Create may be freely distributed under the MIT license.
//     For all details and documentation:
//     http://createjs.org/
(function (jQuery, undefined) {
  // Run JavaScript in strict mode
  /*global jQuery:false _:false document:false */
  'use strict';

  // # Base editing widget
  //
  // This editing widget provides a very simplistic `contentEditable` editor
  // that can be used as standalone, but should more usually be used as
  // the baseclass for other editing widgets.
  //
  // Basic editing widgets on this is easy:
  //
  //     jQuery.widget('Namespace.MyWidget', jQuery.Create.editWidget, {
  //       // override any properties
  //     });
  jQuery.widget('Create.editWidget', {
    options: {
      disabled: false,
      vie: null
    },
    // override to enable the widget
    enable: function () {
      this.element.attr('contenteditable', 'true');
    },
    // override to disable the widget
    disable: function (disable) {
      this.element.attr('contenteditable', 'false');
    },
    // called by the jquery ui plugin factory when creating the widget
    // instance
    _create: function () {
      this._registerWidget();
      this._initialize();
    },
    // called every time the widget is called
    _init: function () {
      if (this.options.disabled) {
        this.disable();
        return;
      }
      this.enable();
    },
    // override this function to initialize the widget functions
    _initialize: function () {
      var self = this;
      var before = this.element.html();
      this.element.bind('blur keyup paste', function (event) {
        if (self.options.disabled) {
          return;
        }
        var current = jQuery(this).html();
        if (before !== current) {
          before = current;
          self.options.modified(current);
        }
      });
    },
    // used to register the widget name with the DOM element
    _registerWidget: function () {
      this.element.data("createWidgetName", this.widgetName);
    }
  });
})(jQuery);
//     Create.js - On-site web editing interface
//     (c) 2012 Tobias Herrmann, IKS Consortium
//     (c) 2011 Rene Kapusta, Evo42
//     Create may be freely distributed under the MIT license.
//     For all details and documentation:
//     http://createjs.org/
(function (jQuery, undefined) {
  // Run JavaScript in strict mode
  /*global jQuery:false _:false document:false Aloha:false */
  'use strict';

  // # Aloha editing widget
  //
  // This widget allows editing textual contents using the
  // [Aloha](http://aloha-editor.org) rich text editor.
  //
  // Due to licensing incompatibilities, Aloha Editor needs to be installed
  // and configured separately.
  jQuery.widget('Create.alohaWidget', jQuery.Create.editWidget, {
    enable: function () {
      this._initialize();
      this.options.disabled = false;
    },
    disable: function () {
      Aloha.jQuery(this.options.element.get(0)).mahalo();
      this.options.disabled = true;
    },
    _initialize: function () {
      var options = this.options;
      var editable;
      var currentElement = Aloha.jQuery(options.element.get(0)).aloha();
      _.each(Aloha.editables, function (aloha) {
        // Find the actual editable instance so we can hook to the events
        // correctly
        if (aloha.obj.get(0) === currentElement.get(0)) {
          editable = aloha;
        }
      });
      if (!editable) {
        return;
      }
      editable.vieEntity = options.entity;

      // Subscribe to activation and deactivation events
      Aloha.bind('aloha-editable-activated', function (event, data) {
        if (data.editable !== editable) {
          return;
        }
        options.activated();
      });
      Aloha.bind('aloha-editable-deactivated', function (event, data) {
        if (data.editable !== editable) {
          return;
        }
        options.deactivated();
      });

      Aloha.bind('aloha-smart-content-changed', function (event, data) {
        if (data.editable !== editable) {
          return;
        }
        if (!data.editable.isModified()) {
          return true;
        }
        options.modified(data.editable.getContents());
        data.editable.setUnmodified();
      });
    }
  });
})(jQuery);
//     Create.js - On-site web editing interface
//     (c) 2012 Tobias Herrmann, IKS Consortium
//     Create may be freely distributed under the MIT license.
//     For all details and documentation:
//     http://createjs.org/
(function (jQuery, undefined) {
  // Run JavaScript in strict mode
  /*global jQuery:false _:false document:false */
  'use strict';

  // # Hallo editing widget
  //
  // This widget allows editing textual content areas with the
  // [Hallo](http://hallojs.org) rich text editor.
  jQuery.widget('Create.halloWidget', jQuery.Create.editWidget, {
    options: {
      editorOptions: {},
      disabled: true,
      toolbarState: 'full',
      vie: null,
      entity: null
    },
    enable: function () {
      jQuery(this.element).hallo({
        editable: true
      });
      this.options.disabled = false;
    },

    disable: function () {
      jQuery(this.element).hallo({
        editable: false
      });
      this.options.disabled = true;
    },

    _initialize: function () {
      jQuery(this.element).hallo(this.getHalloOptions());
      var self = this;
      jQuery(this.element).bind('halloactivated', function (event, data) {
        self.options.activated();
      });
      jQuery(this.element).bind('hallodeactivated', function (event, data) {
        self.options.deactivated();
      });
      jQuery(this.element).bind('hallomodified', function (event, data) {
        self.options.modified(data.content);
        data.editable.setUnmodified();
      });

      jQuery(document).bind('midgardtoolbarstatechange', function(event, data) {
        // Switch between Hallo configurations when toolbar state changes
        if (data.display === self.options.toolbarState) {
          return;
        }
        self.options.toolbarState = data.display;
        var newOptions = self.getHalloOptions();
        self.element.hallo('changeToolbar', newOptions.parentElement, newOptions.toolbar, true);
      });
    },

    getHalloOptions: function() {
      var defaults = {
        plugins: {
          halloformat: {},
          halloblock: {},
          hallolists: {},
          hallolink: {},
          halloimage: {
            entity: this.options.entity
          }
        },
        buttonCssClass: 'create-ui-btn-small',
        placeholder: '[' + this.options.property + ']'
      };

      if (typeof this.element.annotate === 'function' && this.options.vie.services.stanbol) {
        // Enable Hallo Annotate plugin by default if user has annotate.js
        // loaded and VIE has Stanbol enabled
        defaults.plugins.halloannotate = {
            vie: this.options.vie
        };
      }

      if (this.options.toolbarState === 'full') {
        // Use fixed toolbar in the Create tools area
        defaults.parentElement = jQuery('.create-ui-toolbar-dynamictoolarea .create-ui-tool-freearea');
        defaults.toolbar = 'halloToolbarFixed';
      } else {
        // Tools area minimized, use floating toolbar
        defaults.parentElement = 'body';
        defaults.toolbar = 'halloToolbarContextual';
      }
      return _.extend(defaults, this.options.editorOptions);
    }
  });
})(jQuery);
//     Create.js - On-site web editing interface
//     (c) 2012 Henri Bergius, IKS Consortium
//     Create may be freely distributed under the MIT license.
//     For all details and documentation:
//     http://createjs.org/
(function (jQuery, undefined) {
  // Run JavaScript in strict mode
  /*global jQuery:false _:false document:false */
  'use strict';

  // # Redactor editing widget
  //
  // This widget allows editing textual content areas with the
  // [Redactor](http://redactorjs.com/) rich text editor.
  jQuery.widget('Create.redactorWidget', jQuery.Create.editWidget, {
    editor: null,

    options: {
      editorOptions: {},
      disabled: true
    },

    enable: function () {
      jQuery(this.element).redactor(this.getRedactorOptions());
      this.options.disabled = false;
    },

    disable: function () {
      jQuery(this.element).destroyEditor();
      this.options.disabled = true;
    },

    _initialize: function () {
      var self = this;
      jQuery(this.element).bind('focus', function (event) {
        self.options.activated(); 
      });
      /*
      jQuery(this.element).bind('blur', function (event) {
        self.options.deactivated(); 
      });
      */
    },

    getRedactorOptions: function () {
      var self = this;
      var overrides = {
        keyupCallback: function (obj, event) {
          self.options.modified(jQuery(self.element).getCode());
        },
        execCommandCallback: function (obj, command) {
          self.options.modified(jQuery(self.element).getCode());
        }
      };

      return _.extend(self.options.editorOptions, overrides);
    }
  });
})(jQuery);
//     Create.js - On-site web editing interface
//     (c) 2012 Jerry Jalava, IKS Consortium
//     Create may be freely distributed under the MIT license.
//     For all details and documentation:
//     http://createjs.org/
/*
 jQuery(this.element).data('midgardNotifications').create({body: 'Content here!'});
 jQuery(this.element).data('midgardNotifications').create({
 body: "Do you wan't to run tests now?",
     actions: [
         {
             name: 'runtests', label: 'Run tests',
             cb: function(e, notification) {
                 alert('Running tests');
                 notification.close();
             }
         },
         {
             name: 'cancel', label: 'Cancel',
             cb: function(e, notification) {
                 notification.close();
             }
         }
     ]
 });
 */
(function (jQuery, undefined) {
  // Run JavaScript in strict mode
  /*global jQuery:false _:false window:false Backbone:false document:false */
  'use strict';

  var _midgardnotifications_active = [];
  var MidgardNotification = function (parent, options) {
      var _defaults = {
        class_prefix: 'midgardNotifications',
        timeout: 3000,
        // Set to 0 for sticky
        auto_show: true,
        body: '',
        bindTo: null,
        gravity: 'T',
        effects: {
          onShow: function (item, cb) {
            item.animate({
              opacity: 'show'
            }, 600, cb);
          },
          onHide: function (item, cb) {
            item.animate({
              opacity: 'hide'
            }, 600, cb);
          }
        },
        actions: [],
        callbacks: {}
      };
      var _config = {};
      var _classes = {};
      var _item = null;
      var _id = null;
      var _bind_target = null;

      var _parent = parent;

      var _story = null;

      var base = {
        constructor: function (options) {
          _config = _.extend(_defaults, options || {});

          _classes = {
            container: _config.class_prefix + '-container',
            item: {
              wrapper: _config.class_prefix + '-item',
              arrow: _config.class_prefix + '-arrow',
              disregard: _config.class_prefix + '-disregard',
              content: _config.class_prefix + '-content',
              actions: _config.class_prefix + '-actions',
              action: _config.class_prefix + '-action'
            }
          };

          this._generate();
        },
        getId: function () {
          return _id;
        },
        getElement: function () {
          return _item;
        },
        _generate: function () {
          var _self = this;
          var outer, inner, content = null;

          _item = outer = jQuery('<div class="' + _classes.item.wrapper + '-outer"/>');
          outer.css({
            display: 'none'
          });
          inner = jQuery('<div class="' + _classes.item.wrapper + '-inner"/>');
          inner.appendTo(outer);

          if (_config.bindTo) {
            outer.addClass(_classes.item.wrapper + '-binded');

            var arrow = jQuery('<div class="' + _classes.item.arrow + '"/>');
            arrow.appendTo(outer);
          } else {
            outer.addClass(_classes.item.wrapper + '-normal');
          }

          content = jQuery('<div class="' + _classes.item.content + '"/>');
          content.html(_config.body);
          content.appendTo(inner);

          if (_config.actions.length) {
            var actions_holder = jQuery('<div class="' + _classes.item.actions + '"/>');
            actions_holder.appendTo(inner);
            jQuery.each(_config.actions, function (i, opts) {
              var action = jQuery('<button name="' + opts.name + '" class="button-' + opts.name + '">' + opts.label + '</button>').button();
              action.bind('click', function (e) {
                if (_story) {
                  opts.cb(e, _story, _self);
                } else {
                  opts.cb(e, _self);
                }

              });
              if (opts.className) {
                action.addClass(opts.className);
              }
              actions_holder.append(action);
            });
          }

          _item.bind('click', function (e) {
            if (_config.callbacks.onClick) {
              _config.callbacks.onClick(e, _self);
            } else {
              if (!_story) {
                _self.close();
              }
            }
          });

          if (_config.auto_show) {
            this.show();
          }

          this._setPosition();

          _id = _midgardnotifications_active.push(this);

          _parent.append(_item);
        },
        
       _calculatePositionForGravity: function (item, gravity, target, itemDimensions) {
          item.find('.' + _classes.item.arrow).addClass(_classes.item.arrow + '_' + gravity);
          switch (gravity) {
          case 'TL':
            return {
              left: target.left,
              top: target.top + target.height + 'px'
            };
          case 'TR':
            return {
              left: target.left + target.width - itemDimensions.width + 'px',
              top: target.top + target.height + 'px'
            };
          case 'BL':
            return {
              left: target.left + 'px',
              top: target.top - itemDimensions.height + 'px'
            };
          case 'BR':
            return {
              left: target.left + target.width - itemDimensions.width + 'px',
              top: target.top - itemDimensions.height + 'px'
            };
          case 'LT':
            return {
              left: target.left + target.width + 'px',
              top: target.top + 'px'
            };
          case 'LB':
            return {
              left: target.left + target.width + 'px',
              top: target.top + target.height - itemDimensions.height + 'px'
            };
          case 'RT':
            return {
              left: target.left - itemDimensions.width + 'px',
              top: target.top + 'px'
            };
          case 'RB':
            return {
              left: target.left - itemDimensions.width + 'px',
              top: target.top + target.height - itemDimensions.height + 'px'
            };
          case 'T':
            return {
              left: target.left + target.width / 2 - itemDimensions.width / 2 + 'px',
              top: target.top + target.height + 'px'
            };
          case 'R':
            return {
              left: target.left - itemDimensions.width + 'px',
              top: target.top + target.height / 2 - itemDimensions.height / 2 + 'px'
            };
          case 'B':
            return {
              left: target.left + target.width / 2 - itemDimensions.width / 2 + 'px',
              top: target.top - itemDimensions.height + 'px'
            };
          case 'L':
            return {
              left: target.left + target.width + 'px',
              top: target.top + target.height / 2 - itemDimensions.height / 2 + 'px'
            };
          }
        },
        
        _isFixed: function (element) {
          if (element === document) {
            return false;
          }
          if (element.css('position') === 'fixed') {
            return true;
          }
          var parentElement = element.offsetParent();
          if (parentElement.get(0) === element.get(0)) {
            return false;
          }
          return this._isFixed(parentElement);
        },

        _setPosition: function () {
          var pos;
          if (_config.bindTo) {
            var itemDimensions = {
              width: _item.width() ? _item.width() : 280,
              height: _item.height() ? _item.height() : 109
            };
            
            _bind_target = jQuery(_config.bindTo);
            var properties = {};
            
            var targetDimensions = {
              width: _bind_target.outerWidth(),
              height: _bind_target.outerHeight()
            };
            
            if (this._isFixed(_bind_target)) {
              properties.position = 'fixed';
              targetDimensions.left = _bind_target.offset().left;
              targetDimensions.top = _bind_target.position().top;
            } else {
              properties.position = 'absolute';
              targetDimensions.left = _bind_target.offset().left;
              targetDimensions.top = _bind_target.offset().top;
            }
            
            pos = this._calculatePositionForGravity(_item, _config.gravity, targetDimensions, itemDimensions);
            properties.top = pos.top;
            properties.left = pos.left;

            _item.css(properties);

            return;
          }

          if (!_config.position) {
            _config.position = 'top right';
          }

          var marginTop = jQuery('.create-ui-toolbar-wrapper').outerHeight(true) + 6;
          pos = {
            position: 'fixed'
          };

          var item;
          var activeHeight = function (items) {
            var total_height = 0;
            jQuery.each(items, function (i, item) {
              if (!item) {
                return;
              }
              total_height += item.getElement().height();
            });
            return total_height;
          };

          if (_config.position.match(/top/)) {
            pos.top = marginTop + activeHeight(_midgardnotifications_active) + 'px';
          }
          if (_config.position.match(/bottom/)) {
            pos.bottom = (_midgardnotifications_active.length - 1 * item.height()) + item.height() + 10 + 'px';
          }
          if (_config.position.match(/right/)) {
            pos.right = 20 + 'px';
          }
          if (_config.position.match(/left/)) {
            pos.left = 20 + 'px';
          }

          _item.css(pos);
        },
        show: function () {
          var self = this;
          var w_t, w_b, b_b, b_t, e_t, e_h;

          if (_config.callbacks.beforeShow) {
            _config.callbacks.beforeShow(self);
          }

          if (_config.bindTo) {
            var _bind_target = jQuery(_config.bindTo);
            w_t = jQuery(window).scrollTop();
            w_b = jQuery(window).scrollTop() + jQuery(window).height();
            b_t = parseFloat(_item.offset().top, 10);
            e_t = _bind_target.offset().top;
            e_h = _bind_target.outerHeight();

            if (e_t < b_t) {
              b_t = e_t;
            }

            b_b = parseFloat(_item.offset().top, 10) + _item.height();
            if ((e_t + e_h) > b_b) {
              b_b = e_t + e_h;
            }
          }

          if (_config.timeout > 0 && !_config.actions.length) {
            window.setTimeout(function () {
              self.close();
            }, _config.timeout);
          }

          if (_config.bindTo && (b_t < w_t || b_t > w_b) || (b_b < w_t || b_b > w_b)) {
            jQuery('html, body').stop().animate({
              scrollTop: b_t
            }, 500, 'easeInOutExpo', function () {
              _config.effects.onShow(_item, function () {
                if (_config.callbacks.afterShow) {
                  _config.callbacks.afterShow(self);
                }
              });
            });
          } else {
            _config.effects.onShow(_item, function () {
              if (_config.callbacks.afterShow) {
                _config.callbacks.afterShow(self);
              }
            });
          }
        },
        close: function () {
          var self = this;
          if (_config.callbacks.beforeClose) {
            _config.callbacks.beforeClose(self);
          }
          _config.effects.onHide(_item, function () {
            if (_config.callbacks.afterClose) {
              _config.callbacks.afterClose(self);
            }
            self.destroy();
          });
        },
        destroy: function () {
          var self = this;
          jQuery.each(_midgardnotifications_active, function (i, item) {
            if (item) {
              if (item.getId() == self.getId()) {
                delete _midgardnotifications_active[i];
              }
            }
          });
          jQuery(_item).remove();
        },
        setStory: function (story) {
          _story = story;
        },
        setName: function (name) {
          _item.addClass(_classes.item.wrapper + '-custom-' + name);
          this.name = name;
        }
      };
      base.constructor(options);
      delete base.constructor;

      return base;
    };

  var MidgardNotificationStoryline = function (options, items) {
      var _defaults = {};
      var _config = {};
      var _storyline = {};
      var _current_notification = {};
      var _previous_item_name = null;
      var _first_item_name = null;
      var _last_item_name = null;
      var _current_item = null;

      var base = {
        constructor: function (options) {
          _config = _.extend(_defaults, options || {});
        },
        setStoryline: function (items) {
          var default_structure = {
            content: '',
            actions: [],
            show_actions: true,
            notification: {},
            // Notification options to override
            back: null,
            back_label: null,
            forward: null,
            forward_label: null,
            beforeShow: null,
            afterShow: null,
            beforeClose: null,
            afterClose: null
          };

          _storyline = {};
          _current_item = null;
          _previous_item_name = null;
          _first_item_name = null;
          _last_item_name = null;

          var self = this;

          jQuery.each(items, function (name, it) {
            var item = jQuery.extend({}, default_structure, it);
            item.name = name;
            var notification = jQuery.extend({}, default_structure.notification, it.notification || {});
            notification.body = item.content;

            notification.auto_show = false;
            if (item.actions.length) {
              notification.delay = 0;
            }
            notification.callbacks = {
              beforeShow: function (notif) {
                if (item.beforeShow) {
                  item.beforeShow(notif, self);
                }
              },
              afterShow: function (notif) {
                if (item.afterShow) {
                  item.afterShow(notif, self);
                }
              },
              beforeClose: function (notif) {
                if (item.beforeClose) {
                  item.beforeClose(notif, self);
                }
              },
              afterClose: function (notif) {
                if (item.afterClose) {
                  item.afterClose(notif, self);
                }
                _previous_item_name = notif.name;
              }
            };

            notification.actions = [];

            if (item.show_actions) {
              if (item.back) {
                var back_label = item.back_label;
                if (!back_label) {
                  back_label = 'Back';
                }
                notification.actions.push({
                  name: 'back',
                  label: back_label,
                  cb: function (e, story, notif) {
                    story.previous();
                  }
                });
              }

              if (item.forward) {
                var forward_label = item.forward_label;
                if (!forward_label) {
                  forward_label = 'Back';
                }
                notification.actions.push({
                  name: 'forward',
                  label: forward_label,
                  cb: function (e, story, notif) {
                    story.next();
                  }
                });
              }

              if (item.actions.length) {
                jQuery.each(item.actions, function (i, act) {
                  notification.actions.push(item.actions[i]);
                });
              }
            }

            if (!_first_item_name) {
              _first_item_name = name;
            }
            _last_item_name = name;

            item.notification = notification;

            _storyline[name] = item;
          });
          return _storyline;
        },
        start: function () {
          this._showNotification(_storyline[_first_item_name]);
        },
        stop: function () {
          _current_item.close();
          _current_item = null;
          _previous_item_name = null;
        },
        next: function () {
          _current_item.close();
          if (_storyline[_current_item.name].forward) {
            var next_item = _storyline[_current_item.name].forward;
            this._showNotification(_storyline[next_item]);
          } else {
            this._showNotification(_storyline[_last_item_name]);
          }
        },
        previous: function () {
          if (_previous_item_name) {
            _current_item.close();
            if (_storyline[_current_item.name].back) {
              var prev_item = _storyline[_current_item.name].back;
              this._showNotification(_storyline[prev_item]);
            } else {
              this._showNotification(_storyline[_previous_item_name]);
            }
          } else {
            this.stop();
          }
        },
        _showNotification: function (item) {
          _current_item = new MidgardNotification(jQuery('body'), item.notification);
          _current_item.setStory(this);
          _current_item.setName(item.name);
          _current_item.show();

          return _current_item;
        }
      };
      base.constructor(options);
      delete base.constructor;
      if (items) {
        base.setStoryline(items);
      }

      return base;
    };

  var _createTutorialStoryline = {
    'start': {
      content: 'Welcome to CreateJS tutorial!',
      forward: 'toolbar_toggle',
      forward_label: 'Start tutorial',
      actions: [{
        name: 'quit',
        label: 'Quit',
        cb: function (a, story, notif) {
          story.stop();
        }
      }]
    },
    'toolbar_toggle': {
      content: 'This is the CreateJS toolbars toggle button.<br />You can hide and show the full toolbar by clicking here.<br />Try it now.',
      forward: 'edit_button',
      show_actions: false,
      afterShow: function (notification, story) {
        jQuery('body').bind('midgardtoolbarstatechange', function (event, options) {
          if (options.display == 'full') {
            story.next();
            jQuery('body').unbind('midgardtoolbarstatechange');
          }
        });
      },
      notification: {
        bindTo: '#midgard-bar-hidebutton',
        timeout: 0,
        gravity: 'TL'
      }
    },
    'edit_button': {
      content: 'This is the edit button.<br />Try it now.',
      show_actions: false,
      afterShow: function (notification, story) {
        jQuery('body').bind('midgardcreatestatechange', function (event, options) {
          if (options.state == 'edit') {
            story.next();
            jQuery('body').unbind('midgardcreatestatechange');
          }
        });
      },
      notification: {
        bindTo: '.ui-button[for=midgardcreate-edit]',
        timeout: 0,
        gravity: 'TL'
      }
    },
    'end': {
      content: 'Thank you for watching!<br />Happy content editing times await you!'
    }
  };

  jQuery.widget('Midgard.midgardNotifications', {
    options: {
      notification_defaults: {
        class_prefix: 'midgardNotifications',
        position: 'top right'
      }
    },

    _create: function () {
      this.classes = {
        container: this.options.notification_defaults.class_prefix + '-container'
      };

      if (jQuery('.' + this.classes.container, this.element).length) {
        this.container = jQuery('.' + this.classes.container, this.element);
        this._parseFromDOM();
      } else {
        this.container = jQuery('<div class="' + this.classes.container + '" />');
        this.element.append(this.container);
      }
    },

    destroy: function () {
      this.container.remove();
      jQuery.Widget.prototype.destroy.call(this);
    },

    _init: function () {},

    _parseFromDOM: function (path) {

    },

    showStory: function (options, items) {
      var story = new MidgardNotificationStoryline(options, items);
      story.start();

      return story;
    },

    create: function (options) {
      options = jQuery.extend({}, this.options.notification_defaults, options || {});

      var item = new MidgardNotification(this.container, options);
      item.show();

      return item;
    },

    showTutorial: function () {
      this.showStory({}, _createTutorialStoryline);
    }
  });

})(jQuery);
//     Create.js - On-site web editing interface
//     (c) 2011-2012 Henri Bergius, IKS Consortium
//     Create may be freely distributed under the MIT license.
//     For all details and documentation:
//     http://createjs.org/
(function (jQuery, undefined) {
  // Run JavaScript in strict mode
  /*global jQuery:false _:false window:false */
  'use strict';

  jQuery.widget('Midgard.midgardStorage', {
    saveEnabled: true,
    options: {
      // Whether to use localstorage
      localStorage: false,
      removeLocalstorageOnIgnore: true,
      // VIE instance to use for storage handling
      vie: null,
      // URL callback for Backbone.sync
      url: '',
      // Whether to enable automatic saving
      autoSave: false,
      // How often to autosave in milliseconds
      autoSaveInterval: 5000,
      // Whether to save entities that are referenced by entities
      // we're saving to the server.
      saveReferencedNew: false,
      saveReferencedChanged: false,
      // Namespace used for events from midgardEditable-derived widget
      editableNs: 'midgardeditable',
      // CSS selector for the Edit button, leave to null to not bind
      // notifications to any element
      editSelector: '#midgardcreate-edit a',
      // CSS selector for the Save button
      saveSelector: '#midgardcreate-save',
      localize: function (id, language) {
        return window.midgardCreate.localize(id, language);
      },
      language: null
    },

    _create: function () {
      var widget = this;
      this.changedModels = [];

      if (window.localStorage) {
        this.options.localStorage = true;
      }

      this.vie = this.options.vie;

      this.vie.entities.bind('add', function (model) {
        // Add the back-end URL used by Backbone.sync
        model.url = widget.options.url;
        model.toJSON = model.toJSONLD;
      });

      jQuery(widget.options.saveSelector).click(function () {
        widget.saveRemote({
          success: function () {
            jQuery(widget.options.saveSelector).button({
              disabled: true
            });
          },
          error: function () {}
        });
      });

      widget._bindEditables();
      if (widget.options.autoSave) {
        widget._autoSave();
      }
    },

    _autoSave: function () {
      var widget = this;
      widget.saveEnabled = true;

      var doAutoSave = function () {
        if (!widget.saveEnabled) {
          return;
        }

        if (widget.changedModels.length === 0) {
          return;
        }

        widget.saveRemote({
          success: function () {
            jQuery(widget.options.saveSelector).button({
              disabled: true
            });
          },
          error: function () {}
        });
      };

      var timeout = window.setInterval(doAutoSave, widget.options.autoSaveInterval);

      this.element.bind('startPreventSave', function () {
        if (timeout) {
          window.clearInterval(timeout);
          timeout = null;
        }
        widget.disableSave();
      });
      this.element.bind('stopPreventSave', function () {
        if (!timeout) {
          timeout = window.setInterval(doAutoSave, widget.options.autoSaveInterval);
        }
        widget.enableSave();
      });

    },

    enableSave: function () {
      this.saveEnabled = true;
    },

    disableSave: function () {
      this.saveEnabled = false;
    },

    _bindEditables: function () {
      var widget = this;
      this.restorables = [];
      var restorer;

      widget.element.bind(widget.options.editableNs + 'changed', function (event, options) {
        if (_.indexOf(widget.changedModels, options.instance) === -1) {
          widget.changedModels.push(options.instance);
        }
        widget._saveLocal(options.instance);
        jQuery(widget.options.saveSelector).button({disabled: false});
      });

      widget.element.bind(widget.options.editableNs + 'disable', function (event, options) {
        widget._restoreLocal(options.instance);
        jQuery(widget.options.saveSelector).hide();
      });

      widget.element.bind(widget.options.editableNs + 'enable', function (event, options) {
        jQuery(widget.options.saveSelector).button({disabled: true});
        jQuery(widget.options.saveSelector).show();

        if (!options.instance._originalAttributes) {
          options.instance._originalAttributes = _.clone(options.instance.attributes);
        }

        if (!options.instance.isNew() && widget._checkLocal(options.instance)) {
          // We have locally-stored modifications, user needs to be asked
          widget.restorables.push(options.instance);
        }

        /*_.each(options.instance.attributes, function (attributeValue, property) {
          if (attributeValue instanceof widget.vie.Collection) {
            widget._readLocalReferences(options.instance, property, attributeValue);
          }
        });*/
      });

      widget.element.bind('midgardcreatestatechange', function (event, options) {
        if (options.state === 'browse' || widget.restorables.length === 0) {
          widget.restorables = [];
          if (restorer) {
            restorer.close();
          }
          return;
        }
        restorer = widget.checkRestore();
      });

      widget.element.bind('midgardstorageloaded', function (event, options) {
        if (_.indexOf(widget.changedModels, options.instance) === -1) {
          widget.changedModels.push(options.instance);
        }
        jQuery(widget.options.saveSelector).button({
          disabled: false
        });
      });
    },

    checkRestore: function () {
      var widget = this;
      if (widget.restorables.length === 0) {
        return;
      }

      var message;
      if (widget.restorables.length === 1) {
        message = _.template(widget.options.localize('localModification', widget.options.language), {
          label: widget.restorables[0].getSubjectUri()
        });
      } else {
        message = _.template(widget.options.localize('localModifications', widget.options.language), {
          number: widget.restorables.length
        });
      }

      var restorer = jQuery('body').midgardNotifications('create', {
        bindTo: widget.options.editSelector,
        gravity: 'TR',
        body: message,
        timeout: 0,
        actions: [
          {
            name: 'restore',
            label: widget.options.localize('Restore', widget.options.language),
            cb: function() {
              _.each(widget.restorables, function (instance) {
                widget._readLocal(instance);
              });
              widget.restorables = [];
            },
            className: 'create-ui-btn'
          },
          {
            name: 'ignore',
            label: widget.options.localize('Ignore', widget.options.language),
            cb: function(event, notification) {
              if (widget.options.removeLocalstorageOnIgnore) {
                _.each(widget.restorables, function (instance) {
                  widget._removeLocal(instance);
                });
              }
              notification.close();
              widget.restorables = [];
            },
            className: 'create-ui-btn'
          }
        ]
      });
      return restorer;
    },

    saveRemote: function (options) {
      var widget = this;
      if (widget.changedModels.length === 0) {
        return;
      }

      widget._trigger('save', null, {
        models: widget.changedModels
      });

      var notification_msg;
      var needed = widget.changedModels.length;
      if (needed > 1) {
        notification_msg = _.template(widget.options.localize('saveSuccessMultiple', widget.options.language), {
          number: needed
        });
      } else {
        notification_msg = _.template(widget.options.localize('saveSuccess', widget.options.language), {
          label: widget.changedModels[0].getSubjectUri()
        });
      }

      widget.disableSave();
      _.each(widget.changedModels, function (model) {

        // Optionally handle entities referenced in this model first
        _.each(model.attributes, function (value, property) {
          if (!value || !value.isCollection) {
            return;
          }

          value.each(function (referencedModel) {
            if (widget.changedModels.indexOf(referencedModel) !== -1) {
              // The referenced model is already in the save queue
              return;
            }

            if (referencedModel.isNew() && widget.options.saveReferencedNew) {
              return referencedModel.save();
            }

            if (referencedModel.hasChanged() && widget.options.saveReferencedChanged) {
              return referencedModel.save();
            }
          });
        });

        model.save(null, {
          success: function () {
            // From now on we're going with the values we have on server
            model._originalAttributes = _.clone(model.attributes);

            widget._removeLocal(model);
            window.setTimeout(function () {
              widget.changedModels.splice(widget.changedModels.indexOf(model), 1);
            }, 0);
            needed--;
            if (needed <= 0) {
              // All models were happily saved
              widget._trigger('saved', null, {});
              options.success();
              jQuery('body').midgardNotifications('create', {
                body: notification_msg
              });
              widget.enableSave();
            }
          },
          error: function (m, err) {
            options.error();
            jQuery('body').midgardNotifications('create', {
              body: _.template(widget.options.localize('saveError', widget.options.language), {
                error: err.responseText || ''
              }),
              timeout: 0
            });

            widget._trigger('error', null, {
              instance: model
            });
          }
        });
      });
    },

    _saveLocal: function (model) {
      if (!this.options.localStorage) {
        return;
      }

      if (model.isNew()) {
        // Anonymous object, save as refs instead
        if (!model.primaryCollection) {
          return;
        }
        return this._saveLocalReferences(model.primaryCollection.subject, model.primaryCollection.predicate, model);
      }
      window.localStorage.setItem(model.getSubjectUri(), JSON.stringify(model.toJSONLD()));
    },

    _getReferenceId: function (model, property) {
      return model.id + ':' + property;
    },

    _saveLocalReferences: function (subject, predicate, model) {
      if (!this.options.localStorage) {
        return;
      }

      if (!subject || !predicate) {
        return;
      }

      var widget = this;
      var identifier = subject + ':' + predicate;
      var json = model.toJSONLD();
      if (window.localStorage.getItem(identifier)) {
        var referenceList = JSON.parse(window.localStorage.getItem(identifier));
        var index = _.pluck(referenceList, '@').indexOf(json['@']);
        if (index !== -1) {
          referenceList[index] = json;
        } else {
          referenceList.push(json);
        }
        window.localStorage.setItem(identifier, JSON.stringify(referenceList));
        return;
      }
      window.localStorage.setItem(identifier, JSON.stringify([json]));
    },

    _checkLocal: function (model) {
      if (!this.options.localStorage) {
        return false;
      }

      var local = window.localStorage.getItem(model.getSubjectUri());
      if (!local) {
        return false;
      }

      return true;
    },

    _readLocal: function (model) {
      if (!this.options.localStorage) {
        return;
      }

      var local = window.localStorage.getItem(model.getSubjectUri());
      if (!local) {
        return;
      }
      if (!model._originalAttributes) {
        model._originalAttributes = _.clone(model.attributes);
      }
      var parsed = JSON.parse(local);
      var entity = this.vie.entities.addOrUpdate(parsed, {
        overrideAttributes: true
      });

      this._trigger('loaded', null, {
        instance: entity
      });
    },

    _readLocalReferences: function (model, property, collection) {
      if (!this.options.localStorage) {
        return;
      }

      var identifier = this._getReferenceId(model, property);
      var local = window.localStorage.getItem(identifier);
      if (!local) {
        return;
      }
      collection.add(JSON.parse(local));
    },

    _restoreLocal: function (model) {
      var widget = this;

      // Remove unsaved collection members
      if (!model) { return; }
      _.each(model.attributes, function (attributeValue, property) {
        if (attributeValue instanceof widget.vie.Collection) {
          var removables = [];
          attributeValue.forEach(function (model) {
            if (model.isNew()) {
              removables.push(model);
            }
          });
          attributeValue.remove(removables);
        }
      });

      // Restore original object properties
      if (!model.changedAttributes()) {
        if (model._originalAttributes) {
          model.set(model._originalAttributes);
        }
        return;
      }

      model.set(model.previousAttributes());
    },

    _removeLocal: function (model) {
      if (!this.options.localStorage) {
        return;
      }

      window.localStorage.removeItem(model.getSubjectUri());
    }
  });
})(jQuery);
//     Create.js - On-site web editing interface
//     (c) 2012 IKS Consortium
//     Create may be freely distributed under the MIT license.
//     For all details and documentation:
//     http://createjs.org/
(function (jQuery, undefined) {
  // Run JavaScript in strict mode
  /*global jQuery:false _:false window:false */
  'use strict';

  jQuery.widget('Midgard.midgardTags', {
    enhanced: false,

    options: {
      vie: null,
      entity: null,
      element: null,
      entityElement: null,
      parentElement: '.create-ui-tool-metadataarea',
      predicate: 'skos:related',
      templates: {
        button: '<button class="create-ui-btn"><i class="icon-<%= icon %>"></i> <%= label %></button>',
        contentArea: '<div class="dropdown-menu"></div>',
        tags: '<div class="create-ui-tags <%= type %>Tags"><h3><%= label %></h3><input type="text" class="tags" value="" /></div>'
      },
      localize: function (id, language) {
        return window.midgardCreate.localize(id, language);
      },
      language: null
    },

    _init: function () {
      var widget = this;

      this.vie = this.options.vie;
      this.entity = this.options.entity;
      this.element = this.options.element;
      jQuery(this.options.entityElement).bind('midgardeditableactivated', function (event, data) {
        if (data.instance !== widget.options.entity) {
          return;
        }
        widget._renderWidget();
        widget.loadTags();
      });

      jQuery(this.options.entityElement).bind('midgardeditablechanged', function (event, data) {
        if (data.instance !== widget.options.entity) {
          return;
        }
        widget.enhanced = false;
      });

      this._listenAnnotate(this.options.entityElement);
    },

    // Convert to reference URI as needed
    _normalizeSubject: function(subject) {
      if (this.entity.isReference(subject)) {
        return subject;
      }
        
      if (subject.substr(0, 7) !== 'http://') {
        subject = 'urn:tag:' + subject;
      }

      subject = this.entity.toReference(subject);
      return subject;
    },

    _tagLabel: function (subject) {
      subject = this.entity.fromReference(subject);

      if (subject.substr(0, 8) === 'urn:tag:') {
        subject = subject.substr(8, subject.length - 1);
      }

      if (subject.substring(0, 7) == 'http://') {
        subject = subject.substr(subject.lastIndexOf('/') + 1, subject.length - 1);
        subject = subject.replace(/_/g, ' ');
      }
      return subject;
    },

    // Centralized method for adding new tags to an entity
    // regardless of whether they come from this widget
    // or Annotate.js
    addTag: function (subject, label, type) {
      if (label === undefined) {
        label = this._tagLabel(subject);
      }

      subject = this._normalizeSubject(subject);

      if (type && !this.entity.isReference(type)) {
        type = this.entity.toReference(type);
      }

      var tagEntity = this.vie.entities.addOrUpdate({
        '@subject': subject,
        'rdfs:label': label,
        '@type': type
      });

      var tags = this.options.entity.get(this.options.predicate);
      if (!tags) {
        tags = new this.vie.Collection();
        tags.vie = this.options.vie;
        this.options.entity.set(this.options.predicate, tags);
      } else if (!tags.isCollection) {
        tags = new this.vie.Collection(_.map(tags, function(tag) {
          if (tag.isEntity) {
            return tag;
          }
          return {
            '@subject': tag
          };
        }));
        tags.vie = this.options.vie;
        this.options.entity.set(this.options.predicate, tags);
      }

      tags.addOrUpdate(tagEntity);

      this.options.entityElement.trigger('midgardeditablechanged', {
        instance: this.options.entity
      });
    },

    removeTag: function (subject) {
      var tags = this.options.entity.get(this.options.predicate);
      if (!tags) {
        return;
      }

      subject = this._normalizeSubject(subject);
      var tag = tags.get(subject);
      if (!tag) {
        return;
      }

      tags.remove(subject);
      this.options.entityElement.trigger('midgardeditablechanged', {
        instance: this.options.entity
      });
    },

    // Listen for accepted annotations from Annotate.js if that 
    // is in use
    // and register them as tags
    _listenAnnotate: function (entityElement) {
      var widget = this;
      entityElement.bind('annotateselect', function (event, data) {
        widget.addTag(data.linkedEntity.uri, data.linkedEntity.label, data.linkedEntity.type[0]);
      });

      entityElement.bind('annotateremove', function (event, data) {
        widget.removeTag(data.linkedEntity.uri);
      });
    },

    _prepareEditor: function (button) {
      var contentArea = jQuery(_.template(this.options.templates.contentArea, {}));
      var articleTags = jQuery(_.template(this.options.templates.tags, {
        type: 'article',
        label: this.options.localize('Item tags', this.options.language)
      }));
      var suggestedTags = jQuery(_.template(this.options.templates.tags, {
        type: 'suggested',
        label: this.options.localize('Suggested tags', this.options.language)
      }));

      // Tags plugin requires IDs to exist
      jQuery('input', articleTags).attr('id', 'articleTags-' + this.entity.cid);
      jQuery('input', suggestedTags).attr('id', 'suggestedTags-' + this.entity.cid);

      contentArea.append(articleTags);
      contentArea.append(suggestedTags);
      contentArea.hide();

      var offset = button.position();
      contentArea.css('position', 'absolute');
      contentArea.css('left', offset.left);

      return contentArea;
    },

    _renderWidget: function () {
      var widget = this;
      var subject = this.entity.getSubject();

      var button = jQuery(_.template(this.options.templates.button, {
        icon: 'tags',
        label: this.options.localize('Tags', this.options.language)
      }));

      var parentElement = jQuery(this.options.parentElement);
      parentElement.empty();
      parentElement.append(button);
      parentElement.show();

      var contentArea = this._prepareEditor(button);
      button.after(contentArea);

      this.articleTags = jQuery('.articleTags input', contentArea).tagsInput({
        width: 'auto',
        height: 'auto',
        onAddTag: function (tag) {
          widget.addTag(tag);
        },
        onRemoveTag: function (tag) {
          widget.removeTag(tag);
        },
        defaultText: this.options.localize('add a tag', this.options.language)
      });

      var selectSuggested = function () {
        var tag = jQuery.trim(jQuery(this).text());
        widget.articleTags.addTag(tag);
        widget.suggestedTags.removeTag(tag);
      };

      this.suggestedTags = jQuery('.suggestedTags input', contentArea).tagsInput({
        width: 'auto',
        height: 'auto',
        interactive: false,
        onAddTag: function (tag) {
          jQuery('.suggestedTags .tag span', contentArea).unbind('click', selectSuggested);
          jQuery('.suggestedTags .tag span', contentArea).bind('click', selectSuggested);
        },
        onRemoveTag: function (tag) {
          jQuery('.suggestedTags .tag span', contentArea).unbind('click', selectSuggested);
          jQuery('.suggestedTags .tag span', contentArea).bind('click', selectSuggested);
        },
        remove: false
      });

      button.bind('click', function() {
        contentArea.toggle();
      });
    },

    loadTags: function () {
      var widget = this;

      // Populate existing tags from entity
      var tags = this.entity.get(this.options.predicate);
      if (tags) {
        if (_.isString(tags)) {
          widget.articleTags.addTag(widget._tagLabel(tags));
        } else if (tags.isCollection) {
          tags.each(function (tag) {
            widget.articleTags.addTag(tag.get('rdfs:label'));
          });
        } else {
          _.each(tags, function (tag) {
            widget.articleTags.addTag(widget._tagLabel(tag));
          });
        }
      }

      if (this.vie.services.stanbol) {
        widget.enhance();
      } else {
        jQuery('.suggestedTags', widget.element).hide();
      }
    },

    _getLabelLang: function (labels) {
      if (!_.isArray(labels)) {
        return null;
      }

      var langLabel;

      _.each(labels, function (label) {
        if (label['@language'] === 'en') {
          langLabel = label['@value'];
        }
      });

      return langLabel;
    },

    _addEnhancement: function (enhancement) {
      if (!enhancement.isEntity) {
        return;
      }

      var label = this._getLabelLang(enhancement.get('rdfs:label'));
      if (!label) {
        return;
      }

      var tags = this.options.entity.get(this.options.predicate);
      if (tags && tags.isCollection && tags.indexOf(enhancement) !== -1) {
        return;
      }

      this.suggestedTags.addTag(label);
    },

    enhance: function () {
      if (this.enhanced) {
        return;
      }
      this.enhanced = true;

      var widget = this;

      // load suggested tags
      this.vie.analyze({
        element: jQuery('[property]', this.options.entityElement)
      }).using(['stanbol']).execute().success(function (enhancements) {
        _.each(enhancements, function (enhancement) {
          widget._addEnhancement(enhancement);
        });
      }).fail(function (xhr) {
        // console.log(xhr);
      });
    }
  });
})(jQuery);
//     Create.js - On-site web editing interface
//     (c) 2011-2012 Henri Bergius, IKS Consortium
//     Create may be freely distributed under the MIT license.
//     For all details and documentation:
//     http://createjs.org/
(function (jQuery, undefined) {
  // Run JavaScript in strict mode
  /*global jQuery:false _:false window:false */
  'use strict';

  jQuery.widget('Midgard.midgardToolbar', {
    options: {
      display: 'full',
      templates: {
        minimized: '<div class="create-ui-logo"><a class="create-ui-toggle" id="create-ui-toggle-toolbar"></a></div>',
        full: '<div class="create-ui-toolbar-wrapper"><div class="create-ui-toolbar-toolarea"><%= dynamic %><%= status %></div></div>',
        toolcontainer: '<div class="create-ui-toolbar-<%= name %>toolarea"><ul class="create-ui-<%= name %>tools"><%= content %></ul></div>',
        toolarea: '<li class="create-ui-tool-<%= name %>area"></li>'
      }
    },

    _create: function () {
      this.element.append(this._getMinimized());
      this.element.append(this._getFull());

      var widget = this;
      jQuery('.create-ui-toggle', this.element).click(function () {
        if (widget.options.display === 'full') {
          widget.setDisplay('minimized');
        } else {
          widget.setDisplay('full');
        }
      });

      jQuery(this.element).bind('midgardcreatestatechange', function (event, options) {
        if (options.state == 'browse') {
          widget._clearWorkflows();
          widget._clearMetadata();
        }
      });

      jQuery(this.element).bind('midgardworkflowschanged', function (event, options) {
        widget._clearWorkflows();
        if (options.workflows.length) {
          options.workflows.each(function (workflow) {
            var html = jQuery('body').data().midgardWorkflows.prepareItem(options.instance, workflow, function (err, model) {
              widget._clearWorkflows();
              if (err) {
                return;
              }
            });
            jQuery('.create-ui-tool-workflowarea', this.element).append(html);
          });
        }
      });
    },

    _init: function () {
      this.setDisplay(this.options.display);
    },

    setDisplay: function (value) {
      if (value === this.options.display) {
        return;
      }
      if (value === 'minimized') {
        this.hide();
        this.options.display = 'minimized';
      } else {
        this.show();
        this.options.display = 'full';
      }
      this._trigger('statechange', null, this.options);
    },

    hide: function () {
      jQuery('div.create-ui-toolbar-wrapper').fadeToggle('fast', 'linear');
    },

    show: function () {
      jQuery('div.create-ui-toolbar-wrapper').fadeToggle('fast', 'linear');
    },

    _getMinimized: function () {
      return jQuery(_.template(this.options.templates.minimized, {}));
    },

    _getFull: function () {
      return jQuery(_.template(this.options.templates.full, {
        dynamic: _.template(this.options.templates.toolcontainer, {
          name: 'dynamic',
          content:
            _.template(this.options.templates.toolarea, {
              name: 'metadata'
            }) +
            _.template(this.options.templates.toolarea, {
              name: 'workflow'
            }) +
            _.template(this.options.templates.toolarea, {
              name: 'free'
            })
        }),
        status: _.template(this.options.templates.toolcontainer, {
          name: 'status',
          content: ''
        })
      }));
    },

    _clearWorkflows: function () {
      jQuery('.create-ui-tool-workflowarea', this.element).empty();
    },

    _clearMetadata: function () {
      jQuery('.create-ui-tool-metadataarea', this.element).empty();
    }
  });
})(jQuery);
//     Create.js - On-site web editing interface
//     (c) 2012 Jerry Jalava, IKS Consortium
//     Create may be freely distributed under the MIT license.
//     For all details and documentation:
//     http://createjs.org/
(function (jQuery, undefined) {
  // Run JavaScript in strict mode
  /*global jQuery:false _:false window:false Backbone:false */
  'use strict';

  jQuery.widget('Midgard.midgardWorkflows', {
    options: {
      url: function (model) {},
      templates: {
        button: '<button class="create-ui-btn" id="<%= id %>"><%= label %></button>'
      },
      renderers: {
        button: function (model, workflow, action_cb, final_cb) {
          var button_id = 'midgardcreate-workflow_' + workflow.get('name');
          var html = jQuery(_.template(this.options.templates.button, {
            id: button_id,
            label: workflow.get('label')
          })).button();

          html.bind('click', function (evt) {
            action_cb(model, workflow, final_cb);
          });
          return html;
        }
      },
      action_types: {
        backbone_save: function (model, workflow, callback) {
          var copy_of_url = model.url;
          var original_model = model.clone();
          original_model.url = copy_of_url;

          var action = workflow.get('action');
          if (action.url) {
            model.url = action.url;
          }
          original_model.save(null, {
            success: function (m) {
              model.url = copy_of_url;
              model.change();
              callback(null, model);
            },
            error: function (m, err) {
              model.url = copy_of_url;
              model.change();
              callback(err, model);
            }
          });
        },
        backbone_destroy: function (model, workflow, callback) {
          var copy_of_url = model.url;
          var original_model = model.clone();
          original_model.url = copy_of_url;

          var action = workflow.get('action');
          if (action.url) {
            model.url = action.url;
          }

          model.destroy({
            success: function (m) {
              model.url = copy_of_url;
              model.change();
              callback(null, m);
            },
            error: function (m, err) {
              model.url = copy_of_url;
              model.change();
              callback(err, model);
            }
          });
        },
        http: function (model, workflow, callback) {
          var action = workflow.get('action');
          if (!action.url) {
            return callback('No action url defined!');
          }

          var wf_opts = {};
          if (action.http) {
            wf_opts = action.http;
          }

          var ajax_options = jQuery.extend({
            url: action.url,
            type: 'POST',
            data: model.toJSON(),
            success: function () {
              model.fetch({
                success: function (model) {
                  callback(null, model);
                },
                error: function (model, err) {
                  callback(err, model);
                }
              });
            }
          }, wf_opts);

          jQuery.ajax(ajax_options);
        }
      }
    },

    _init: function () {
      this._renderers = {};
      this._action_types = {};

      this._parseRenderersAndTypes();

      this._last_instance = null;

      this.ModelWorkflowModel = Backbone.Model.extend({
        defaults: {
          name: '',
          label: '',
          type: 'button',
          action: {
            type: 'backbone_save'
          }
        }
      });

      this.workflows = {};

      var widget = this;
      jQuery(this.element).bind('midgardeditableactivated', function (event, options) {
        widget._fetchWorkflows(options.instance);
      });
    },

    _fetchWorkflows: function (model) {
      var widget = this;
      if (model.isNew()) {
        widget._trigger('changed', null, {
          instance: model,
          workflows: []
        });
        return;
      }

      if (widget._last_instance == model) {
        if (widget.workflows[model.cid]) {
          widget._trigger('changed', null, {
            instance: model,
            workflows: widget.workflows[model.cid]
          });
        }
        return;
      }
      widget._last_instance = model;

      if (widget.workflows[model.cid]) {
        widget._trigger('changed', null, {
          instance: model,
          workflows: widget.workflows[model.cid]
        });
        return;
      }

      if (widget.options.url) {
        widget._fetchModelWorkflows(model);
      } else {
        var flows = new(widget._generateCollectionFor(model))([], {});
        widget._trigger('changed', null, {
          instance: model,
          workflows: flows
        });
      }
    },

    _parseRenderersAndTypes: function () {
      var widget = this;
      jQuery.each(this.options.renderers, function (k, v) {
        widget.setRenderer(k, v);
      });
      jQuery.each(this.options.action_types, function (k, v) {
        widget.setActionType(k, v);
      });
    },

    setRenderer: function (name, callbacks) {
      this._renderers[name] = callbacks;
    },
    getRenderer: function (name) {
      if (!this._renderers[name]) {
        return false;
      }

      return this._renderers[name];
    },
    setActionType: function (name, callback) {
      this._action_types[name] = callback;
    },
    getActionType: function (name) {
      return this._action_types[name];
    },

    prepareItem: function (model, workflow, final_cb) {
      var widget = this;

      var renderer = this.getRenderer(workflow.get("type"));
      var action_type_cb = this.getActionType(workflow.get("action").type);

      return renderer.call(this, model, workflow, action_type_cb, function (err, m) {
        delete widget.workflows[model.cid];
        widget._last_instance = null;
        if (workflow.get('action').type !== 'backbone_destroy') {
          // Get an updated list of workflows
          widget._fetchModelWorkflows(model);
        }
        final_cb(err, m);
      });
    },

    _generateCollectionFor: function (model) {
      var collectionSettings = {
        model: this.ModelWorkflowModel
      };
      if (this.options.url) {
        collectionSettings.url = this.options.url(model);
      }
      return Backbone.Collection.extend(collectionSettings);
    },

    _fetchModelWorkflows: function (model) {
      if (model.isNew()) {
        return;
      }
      var widget = this;

      widget.workflows[model.cid] = new(this._generateCollectionFor(model))([], {});
      widget.workflows[model.cid].fetch({
        success: function (collection) {
          widget.workflows[model.cid].reset(collection.models);

          widget._trigger('changed', null, {
            instance: model,
            workflows: widget.workflows[model.cid]
          });
        },
        error: function (model, err) {
          //console.log('error fetching flows', err);
        }
      });
    }
  });
})(jQuery);
if (window.midgardCreate === undefined) {
  window.midgardCreate = {};
}
if (window.midgardCreate.locale === undefined) {
  window.midgardCreate.locale = {};
}

window.midgardCreate.locale.cs = {
  // Session-state buttons for the main toolbar
  'Save': 'Uložit',
  'Saving': 'Probíhá ukládání',
  'Cancel': 'Zrušit',
  'Edit': 'Upravit',
  // Storage status messages
  'localModification': 'Blok "<%= label %>" obsahuje lokální změny',
  'localModifications': '<%= number %> bloků na této stránce má lokální změny',
  'Restore': 'Aplikovat lokální změny',
  'Ignore': 'Zahodit lokální změny',
  'saveSuccess': 'Blok "<%= label %>" byl úspěšně uložen',
  'saveSuccessMultiple': '<%= number %> bloků bylo úspěšně uloženo',
  'saveError': 'Při ukládání došlo k chybě<br /><%= error %>',
  // Tagging
  'Item tags': 'Štítky bloku',
  'Suggested tags': 'Navrhované štítky',
  'Tags': 'Štítky',
  'add a tag': 'Přidat štítek',
  // Collection widgets
  'Add': 'Přidat',
  'Choose type to add': 'Vyberte typ k přidání'
};
if (window.midgardCreate === undefined) {
  window.midgardCreate = {};
}
if (window.midgardCreate.locale === undefined) {
  window.midgardCreate.locale = {};
}

window.midgardCreate.locale.da = {
  // Session-state buttons for the main toolbar
  'Save': 'Gem',
  'Saving': 'Gemmer',
  'Cancel': 'Annullér',
  'Edit': 'Rediger',
  // Storage status messages
  'localModification': 'Element "<%= label %>" har lokale ændringer',
  'localModifications': '<%= number %> elementer på denne side har lokale ændringer',
  'Restore': 'Gendan',
  'Ignore': 'Ignorer',
  'saveSuccess': 'Element "<%= label %>" er gemt',
  'saveSuccessMultiple': '<%= number %> elementer er gemt',
  'saveError': 'Der opstod en fejl under lagring<br /><%= error %>',
  // Tagging
  'Item tags': 'Element tags',
  'Suggested tags': 'Foreslåede tags',
  'Tags': 'Tags',
  'add a tag': 'tilføj et tag',
  // Collection widgets
  'Add': 'Tilføj',
  'Choose type to add': 'Vælg type der skal tilføjes'
};
if (window.midgardCreate === undefined) {
  window.midgardCreate = {};
}
if (window.midgardCreate.locale === undefined) {
  window.midgardCreate.locale = {};
}

window.midgardCreate.locale.de = {
  // Session-state buttons for the main toolbar
  'Save': 'Speichern',
  'Saving': 'Speichert',
  'Cancel': 'Abbrechen',
  'Edit': 'Bearbeiten',
  // Storage status messages
  'localModification': 'Das Dokument "<%= label %>" auf dieser Seite hat lokale Änderungen',
  'localModifications': '<%= number %> Dokumente auf dieser Seite haben lokale Änderungen',
  'Restore': 'Wiederherstellen',
  'Ignore': 'Ignorieren',
  'saveSuccess': 'Dokument "<%= label %>" erfolgreich gespeichert',
  'saveSuccessMultiple': '<%= number %> Dokumente erfolgreich gespeichert',
  'saveError': 'Fehler beim Speichern<br /><%= error %>',
  // Tagging
  'Item tags': 'Schlagwörter des Dokuments',
  'Suggested tags': 'Schlagwortvorschläge',
  'Tags': 'Schlagwörter',
  'add a tag': 'Neues Schlagwort',
  // Collection widgets
  'Add': 'Hinzufügen',
  'Choose type to add': 'Typ zum Hinzufügen wählen'
};
if (window.midgardCreate === undefined) {
  window.midgardCreate = {};
}
if (window.midgardCreate.locale === undefined) {
  window.midgardCreate.locale = {};
}

window.midgardCreate.locale.en = {
  // Session-state buttons for the main toolbar
  'Save': 'Save',
  'Saving': 'Saving',
  'Cancel': 'Cancel',
  'Edit': 'Edit',
  // Storage status messages
  'localModification': 'Item "<%= label %>" has local modifications',
  'localModifications': '<%= number %> items on this page have local modifications',
  'Restore': 'Restore',
  'Ignore': 'Ignore',
  'saveSuccess': 'Item "<%= label %>" saved successfully',
  'saveSuccessMultiple': '<%= number %> items saved successfully',
  'saveError': 'Error occurred while saving<br /><%= error %>',
  // Tagging
  'Item tags': 'Item tags',
  'Suggested tags': 'Suggested tags',
  'Tags': 'Tags',
  'add a tag': 'add a tag',
  // Collection widgets
  'Add': 'Add',
  'Choose type to add': 'Choose type to add'
};
if (window.midgardCreate === undefined) {
  window.midgardCreate = {};
}
if (window.midgardCreate.locale === undefined) {
  window.midgardCreate.locale = {};
}

window.midgardCreate.locale.fi = {
  // Session-state buttons for the main toolbar
  'Save': 'Tallenna',
  'Saving': 'Tallennetaan',
  'Cancel': 'Peruuta',
  'Edit': 'Muokkaa',
  // Storage status messages
  'localModification': 'Dokumentilla "<%= label %>" on paikallisia muutoksia',
  'localModifications': '<%= number %> dokumenttia sivulla omaa paikallisia muutoksia',
  'Restore': 'Palauta',
  'Ignore': 'Poista',
  'saveSuccess': 'Dokumentti "<%= label %>" tallennettu',
  'saveSuccessMultiple': '<%= number %> dokumenttia tallennettu',
  'saveError': 'Virhe tallennettaessa<br /><%= error %>',
  // Tagging
  'Item tags': 'Avainsanat',
  'Suggested tags': 'Ehdotukset',
  'Tags': 'Avainsanat',
  'add a tag': 'lisää avainsana',
  // Collection widgets
  'Add': 'Lisää',
  'Choose type to add': 'Mitä haluat lisätä?'
};
if (window.midgardCreate === undefined) {
  window.midgardCreate = {};
}
if (window.midgardCreate.locale === undefined) {
  window.midgardCreate.locale = {};
}

window.midgardCreate.locale.fr = {
  // Session-state buttons for the main toolbar
  'Save': 'Sauver',
  'Saving': 'En cours',
  'Cancel': 'Annuler',
  'Edit': 'Editer',
  // Storage status messages
  'localModification': 'Objet "<%= label %>" sur cette page ont des modifications locales',
  'localModifications': '<%= number %> élements sur cette page ont des modifications locales',
  'Restore': 'Récupérer',
  'Ignore': 'Ignorer',
  'saveSuccess': '"<%= label %>" est sauvegardé avec succès',
  'saveSuccessMultiple': '<%= number %> éléments ont été sauvegardé avec succès',
  'saveError': 'Une erreur est survenue durant la sauvegarde:<br /><%= error %>',
  // Tagging
  'Item tags': 'Tags des objets',
  'Suggested tags': 'Tags suggérés',
  'Tags': 'Tags',
  'add a tag': 'ajouter un tag',
  // Collection widgets
  'Add': 'Ajouter',
  'Choose type to add': 'Choisir le type à ajouter'
};
if (window.midgardCreate === undefined) {
  window.midgardCreate = {};
}
if (window.midgardCreate.locale === undefined) {
  window.midgardCreate.locale = {};
}

window.midgardCreate.locale.it = {
  // Session-state buttons for the main toolbar
  'Save': 'Salva',
  'Saving': 'Salvataggio',
  'Cancel': 'Cancella',
  'Edit': 'Modifica',
  // Storage status messages
  'localModification': 'Articolo "<%= label %>" in questa pagina hanno modifiche locali',
  'localModifications': '<%= number %> articoli in questa pagina hanno modifiche locali',
  'Restore': 'Ripristina',
  'Ignore': 'Ignora',
  'saveSuccess': 'Articolo "<%= label %>" salvato con successo',
  'saveSuccessMultiple': '<%= number %> articoli salvati con successo',
  'saveError': 'Errore durante il salvataggio<br /><%= error %>',
  // Tagging
  'Item tags': 'Tags articolo',
  'Suggested tags': 'Tags suggerite',
  'Tags': 'Tags',
  'add a tag': 'Aggiungi una parola chiave',
  // Collection widgets
  'Add': 'Aggiungi',
  'Choose type to add': 'Scegli il tipo da aggiungere'
};
if (window.midgardCreate === undefined) {
  window.midgardCreate = {};
}
if (window.midgardCreate.locale === undefined) {
  window.midgardCreate.locale = {};
}

window.midgardCreate.locale.nl = {
  // Session-state buttons for the main toolbar
  'Save': 'Opslaan',
  'Saving': 'Bezig met opslaan',
  'Cancel': 'Annuleren',
  'Edit': 'Bewerken',
  // Storage status messages
  'localModification': 'Items "<%= label %>" op de pagina heeft lokale wijzigingen',
  'localModifications': '<%= number %> items op de pagina hebben lokale wijzigingen',
  'Restore': 'Herstellen',
  'Ignore': 'Negeren',
  'saveSuccess': 'Item "<%= label %>" succesvol opgeslagen',
  'saveSuccessMultiple': '<%= number %> items succesvol opgeslagen',
  'saveError': 'Fout opgetreden bij het opslaan<br /><%= error %>',
  // Tagging
  'Item tags': 'Item tags',
  'Suggested tags': 'Tag suggesties',
  'Tags': 'Tags',
  'add a tag': 'tag toevoegen',
  // Collection widgets
  'Add': 'Toevoegen',
  'Choose type to add': 'Kies type om toe te voegen'
};
if (window.midgardCreate === undefined) {
  window.midgardCreate = {};
}
if (window.midgardCreate.locale === undefined) {
  window.midgardCreate.locale = {};
}

window.midgardCreate.locale.no = {
  // Session-state buttons for the main toolbar
  'Save': 'Lagre',
  'Saving': 'Lagrer',
  'Cancel': 'Avbryt',
  'Edit': 'Rediger',
  // Storage status messages
  'localModification': 'Element "<%= label %>" på denne siden er modifisert lokalt',
  'localModifications': '<%= number %> elementer på denne siden er modifisert lokalt',
  'Restore': 'Gjenopprett',
  'Ignore': 'Ignorer',
  'saveSuccess': 'Element "<%= label %>" ble lagret',
  'saveSuccessMultiple': '<%= number %> elementer ble lagret',
  'saveError': 'En feil oppstod under lagring<br /><%= error %>',
  // Tagging
  'Item tags': 'Element-tagger',
  'Suggested tags': 'Anbefalte tagger',
  'Tags': 'Tagger',
  'add a tag': 'legg til tagg',
  // Collection widgets
  'Add': 'Legg til',
  'Choose type to add': 'Velg type å legge til'
};
if (window.midgardCreate === undefined) {
  window.midgardCreate = {};
}
if (window.midgardCreate.locale === undefined) {
  window.midgardCreate.locale = {};
}

window.midgardCreate.locale.pl = {
  // Session-state buttons for the main toolbar
  'Save': 'Zapisz',
  'Saving': 'Zapisuję',
  'Cancel': 'Anuluj',
  'Edit': 'Edytuj',
  // Storage status messages
  'localModification': 'Artykuł "<%= label %>" posiada lokalne modyfikacje',
  'localModifications': '<%= number %> artykułów na tej stronie posiada lokalne modyfikacje',
  'Restore': 'Przywróć',
  'Ignore': 'Ignoruj',
  'saveSuccess': 'Artykuł "<%= label %>" został poprawnie zapisany',
  'saveSuccessMultiple': '<%= number %> artykułów zostało poprawnie zapisanych',
  'saveError': 'Wystąpił błąd podczas zapisywania<br /><%= error %>',
  // Tagging
  'Item tags': 'Tagi artykułów',
  'Suggested tags': 'Sugerowane tagi',
  'Tags': 'Tagi',
  'add a tag': 'dodaj tag',
  // Collection widgets
  'Add': 'Dodaj',
  'Choose type to add': 'Wybierz typ do dodania'
};
if (window.midgardCreate === undefined) {
  window.midgardCreate = {};
}
if (window.midgardCreate.locale === undefined) {
  window.midgardCreate.locale = {};
}

window.midgardCreate.locale.pt_BR = {
  // Session-state buttons for the main toolbar
  'Save': 'Salvar',
  'Saving': 'Salvando',
  'Cancel': 'Cancelar',
  'Edit': 'Editar',
  // Storage status messages
  'localModification': 'Item "<%= label %>" nesta página possuem modificações locais',
  'localModifications': '<%= number %> itens nesta página possuem modificações locais',
  'Restore': 'Restaurar',
  'Ignore': 'Ignorar',
  'saveSuccess': 'Item "<%= label %>" salvo com sucesso',
  'saveSuccessMultiple': '<%= number %> itens salvos com sucesso',
  'saveError': 'Erro ocorrido ao salvar<br /><%= error %>',
  // Tagging
  'Item tags': 'Tags de item',
  'Suggested tags': 'Tags sugeridas',
  'Tags': 'Tags',
  'add a tag': 'adicionar uma tag',
  // Collection widgets
  'Add': 'Adicionar',
  'Choose type to add': 'Selecione o tipo para adicionar'
};
if (window.midgardCreate === undefined) {
  window.midgardCreate = {};
}
if (window.midgardCreate.locale === undefined) {
  window.midgardCreate.locale = {};
}

window.midgardCreate.locale.ru = {
  // Session-state buttons for the main toolbar
  'Save': 'Сохранить',
  'Saving': 'Сохраняю',
  'Cancel': 'Отмена',
  'Edit': 'Редактировать',
  // Storage status messages
  'localModification': 'В запись "<%= label %>" внесены несохранённые изменения',
  'localModifications': 'В записи на этой странице (<%= number %> шт.) внесены несохранённые изменения',
  'Restore': 'Восстановить',
  'Ignore': 'Игнорировать',
  'saveSuccess': 'Запись "<%= label %>" была успешно сохранена',
  'saveSuccessMultiple': ' Записи (<%= number %> шт.) были успешно сохранены',
  'saveError': 'Во время сохранения произошла ошибка<br /><%= error %>',
  // Tagging
  'Item tags': 'Теги записей',
  'Suggested tags': 'Предлагаемые теги',
  'Tags': 'Теги',
  'add a tag': 'добавить тег',
  // Collection widgets
  'Add': 'Добавить',
  'Choose type to add': 'Выбрать тип для добавления'
};
if (window.midgardCreate === undefined) {
  window.midgardCreate = {};
}

window.midgardCreate.localize = function (id, language) {
  if (!window.midgardCreate.locale) {
    // No localization files loaded, return as-is
    return id;
  }
  if (window.midgardCreate.locale[language] && window.midgardCreate.locale[language][id]) {
    return window.midgardCreate.locale[language][id];
  }
  if (window.midgardCreate.locale.en[id]) {
    return window.midgardCreate.locale.en[id];
  }
  return id;
};
