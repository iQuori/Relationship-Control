(function ($, window, document, undefined) {

    var constants = {

        TAU: Math.PI * 2.0,
        LEFT_BUTTON: 0,
        MIDDLE_BUTTON: 1,
        RIGHT_BUTTON: 2,
        DEFAULT_TEMPLATE: "<div style='background-color: lightblue; width: 100px; height: 100px; text-align: center;'><br />{{Id}}<br />{{Type}}<br />{{Weight}}</div>"
    };

    var Control = {

        // Initialisation.  Called from $.fn.relationshipControl, for each control matching the selector this is attached too
        init: function (options, element) {

            var self = this;
            self.version = "0.1 beta";

            // prevent the context menu from being displayed on a right-click
            document.oncontextmenu = function (e) { return !($(e.target).closest(".relationshipItem").length); };

            self.options = $.extend({}, $.fn.relationshipControl.options, options);

            self.element = element;
            self.$element = $(element);

            // compile the templates
            self.compiledTemplates = [];
            self.options.itemTemplates.forEach(function (template, index) {

                var type = template["Type"];
                var id = "#" + template["Name"];
                self.compiledTemplates[type] = Handlebars.compile($.trim($(id).html()));
            });

            $(window).on("resize", function () { self.resizeControl.call(self) });
            self.resizeControl();
        
            self.applyRequiredControlStyles();
            self.refreshItems();
        },
        
        // Helper function
        applyRequiredControlStyles: function () {

            return this.$element.css({ "position": "relative", "display": "inline-block", "overflow": "hidden" });
        },

        // Recalculate values based on the new size of the control
        resizeControl: function () {
            
            this.controlWidth = this.$element.width();
            this.controlHeight = this.$element.height();

            // shape === square
            this.xOffset = 0.0;
            this.yOffset = 0.0;
            this.scaleX = this.controlWidth / 2.0;
            this.scaleY = this.controlHeight / 2.0;

            if (this.options.shape === "square") {

                var offset = Math.abs(this.scaleX - this.scaleY);
                if (this.scaleX > this.scaleY) {
                    this.scaleX -= offset;
                    this.xOffset = offset;
                }
                else {
                    this.scaleY -= offset;
                    this.yOffset = offset;
                }
            }

            this.repositionItems();

            return this;
        },

        // Refresh the items in the control
        refreshItems: function (selectedType, selectedId) {

            var self = this;

            return self.fetchItems(selectedType, selectedId)
                .done(function (items) {

                    self.addItems(items)
                        .addItemEventHandlers()
                        .repositionItems();

                    if (typeof self.options.onRefreshComplete === "function") {

                        self.options.onRefreshComplete.apply(self.elem, arguments);
                    }
                });
        },

        // Fetch new items from the server
        fetchItems: function (selectedType, selectedId) {
            
            var controlId = this.$element.attr("id")

            selectedType = selectedType || "";
            selectedId = selectedId || 0;

            // return a promise
            return $.ajax({
                url: this.options.getItemsUrl,
                data:
                    {
                        controlId: controlId,
                        selectedType: selectedType,
                        selectedId: selectedId
                    },
                datatype: "json"
            });
        },

        // Add the items to the control
        addItems: function (items) {

            var self = this,
                itemCount = items.length;

            self.$element.empty();

            $.each(items, function (index, item) {

                // load the template for this item type
                var template = $.fn.relationshipControl.defaultTemplate
                if (self.compiledTemplates[item.Type])
                    template = self.compiledTemplates[item.Type];

                var $html = $(template(item))
                    .addClass("relationshipItem")
                    .css(
                    { 
                        "position": "absolute", 
                        "cursor": "pointer", 
                        "overflow": "hidden"
                    })
                    .data("relationshipid", item.Id)
                    .data("relationshiptype", item.Type)
                    .data("relationshipweight", item.Weight)
                    .data("relationshippriority", itemCount - index);

                // determine starting position for effect
                var left = 0, top = 0;
                switch (self.options.flyIn)
                {
                    case "centre":
                        left = self.$element.width() / 2.0;
                        top = self.$element.height() / 2.0;
                        break;

                    case "top":
                        left = self.$element.width() / 2.0;
                        top = 0;
                        break;

                    case "left":
                        left = 0;
                        top = self.$element.height() / 2.0;
                        break;

                    case "bottom":
                        left = self.$element.width() / 2.0;
                        top = self.$element.height();
                        break;

                    case "right":
                        left = self.$element.width();
                        top = self.$element.height() / 2.0;
                        break;

                    default: // "random"
                        left = Math.random() * self.$element.width();
                        top = Math.random() * self.$element.height();
                        break;
                }

                $html.css(
                    {
                        "top": top - $html.height() / 2.0,
                        "left": left - $html.width() / 2.0
                    });

                self.$element.append($html)
            });

            return this;
        },

        // Apply required event handlers to the items
        addItemEventHandlers: function ()
        {
            var self = this;
            var items = this.$element.children(".relationshipItem");

            items.each(function (index, item) {

                $(item).on('click contextmenu', function (e) {

                    var $item = $(this);

                    if (e.button === constants.LEFT_BUTTON) {
                        // left button pressed
                        self.refreshItems.call(self, $item.data("relationshiptype"), $item.data("relationshipid"));
                    }
                    else if (e.button === constants.RIGHT_BUTTON) {
                        // right button pressed
                        if (typeof self.options.onItemRightClick === "function") {

                            var $containerOffset = $item.closest(".relationshipItem").offset();

                            var x = e.pageX - $containerOffset.left;
                            var y = e.pageY - $containerOffset.top;

                            self.options.onItemRightClick.call(item, $item.data("relationshiptype"), $item.data("relationshipid"), x, y);
                        }
                    }
                    else if (e.button === constants.MIDDLE_BUTTON) {
                        // middle button pressed
                        if (typeof self.options.onItemMiddleClick === "function") {

                            var $containerOffset = $item.closest(".relationshipItem").offset();

                            var x = e.pageX - $containerOffset.left;
                            var y = e.pageY - $containerOffset.top;

                            self.options.onItemMiddleClick.call(item, $item.data("relationshiptype"), $item.data("relationshipid"), x, y);
                        }
                    }

                    e.preventDefault;
                })
                .hover(
                    function (e) {

                        var $item = $(this);
                        $item.css("z-index", 10000);

                        if (self.options.opacityFallOff) {
                            $item.animate({ "opacity": 1.0 }, 250);
                        }

                        e.preventDefault;
                    },
                    function (e) {

                        var $item = $(this);
                        $item.css("z-index", $item.data("relationshippriority"));

                        if (self.options.opacityFallOff) {
                            $item.animate({ "opacity": 1.0 - $item.data("relationshipweight") }, 250);
                        }

                        e.preventDefault;
                    }
                );
            });

            return this;
        },

        // Scale an X coord (-1.0 < X < 1.0) to a position in the container
        scaleXCoord: function (x) {
            return this.xOffset + (x + 1.0) * this.scaleX;
        },

        // Scale an Y coord (-1.0 < Y < 1.0) to a position in the container
        scaleYCoord: function (y) {
            return this.yOffset + (y + 1.0) * this.scaleY;
        },

        // Determine the top left of the item from it's centre coordinates
        topLeftFromCentre: function ($item, x, y) {

            return {
                x: Math.round(this.scaleXCoord(x) - $item.width() / 2.0), 
                y: Math.round(this.scaleYCoord(y) - $item.height() / 2.0 )
            };
        },

        // Animate all of the items to their new positions
        repositionItems: function () {

            var items = this.$element.children(".relationshipItem");
            var itemCount = items.length;

            if (itemCount === 0)
                return;

            var deltaAngle = constants.TAU / itemCount;

            var angle = 0.0;
            for (var i = 0; i < itemCount; i++) {

                var $item = $(items[i]);

                var weight = $item.data("relationshipweight");
                var x = weight * Math.cos(angle);
                var y = weight * Math.sin(angle);

                $item.css("z-index", itemCount - i);

                // stop any current animation
                if ($item.is(":animated")) { $item.stop(); }

                var pos = this.topLeftFromCentre($item, x, y);
                var opacity = this.options.opacityFallOff ? Math.max(this.options.minimumOpacity, 1.0 - weight) : 1.0;

                $item.animate(
                    {
                        "left": pos.x,
                        "top": pos.y,
                        "opacity": opacity
                    },
                    {
                        duration: this.options.duration,
                        specialEasing: {
                            top: this.options.easing,
                            left: this.options.easing,
                            opacity: this.options.easing,
                        }
                    });

                angle += deltaAngle;
            }
        }
    };

    // Create the instances of the relationshipControl plugin
    $.fn.relationshipControl = function (options) {

        return this.each(function () {

            var control = Object.create(Control);
            control.init(options, this);
        });
    };

    // The default options of the relationshipControl plugin
    $.fn.relationshipControl.options = {

        getItemsUrl: "/Home/GetItems",
        shape: "auto",
        opacityFallOff: true,
        minimumOpacity: 0.1,
        itemTemplates: [],
        flyIn: "random",
        duration: 2000,
        easing: "linear",
        position: "", // positioning of items TODO
        onItemMiddleClick: null,
        onItemRightClick: null,
        onRefreshComplete: null
    };

    // The default template of the relationshipControl plugin
    $.fn.relationshipControl.defaultTemplate = Handlebars.compile(constants.DEFAULT_TEMPLATE);

})(jQuery, window, document);
