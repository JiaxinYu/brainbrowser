/*
* BrainBrowser: Web-based Neurological Visualization Tools
* (https://brainbrowser.cbrain.mcgill.ca)
*
* Copyright (C) 2011
* The Royal Institution for the Advancement of Learning
* McGill University
*
* This program is free software: you can redistribute it and/or modify
* it under the terms of the GNU Affero General Public License as
* published by the Free Software Foundation, either version 3 of the
* License, or (at your option) any later version.
*
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU Affero General Public License for more details.
*
* You should have received a copy of the GNU Affero General Public License
* along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

/*
* Author: Tarek Sherif <tsherif@gmail.com> (http://tareksherif.ca/)
*/

BrainBrowser.SurfaceViewer.modules.views = function(viewer) {
  "use strict";

  // View change functions
  var views = {
    medialView: function(model_data) {
      var model = viewer.model;

      if(model_data.split) {
        model.getObjectByName("left").position.x -= 100;
        model.getObjectByName("left").rotation.z -= Math.PI / 2;
        model.getObjectByName("right").position.x += 100;
        model.getObjectByName("right").rotation.z += Math.PI / 2;
        model.rotation.x -= Math.PI / 2;
      }
    },

    lateralView: function(model_data) {
      var model = viewer.model;
      var left_child, right_child;

      if(model_data.split) {
        left_child = model.getObjectByName("left");
        right_child = model.getObjectByName("right");

        left_child.position.x -= 100;
        left_child.rotation.z -= Math.PI / 2;
        right_child.position.x += 100;
        right_child.rotation.z += Math.PI / 2;
        model.rotation.x += Math.PI / 2;
        model.rotation.y += Math.PI;
      }
    },

    inferiorView: function() {
      viewer.model.rotation.y += Math.PI;
    },

    anteriorView: function() {
      viewer.resetView();
      viewer.model.rotation.x -= Math.PI / 2;
      viewer.model.rotation.z += Math.PI;
    },

    posteriorView : function() {
      viewer.resetView();
      viewer.model.rotation.x -= Math.PI / 2;
    }
  };
  
  /**
  * @doc function
  * @name viewer.views:setTransparency
  * @param {number} alpha The value to set the opacity to (between 0 and 1).
  * @param {objects} options currently the only supported option is **shape_name**
  *   which causes the transparency to apply only to the shape with the given name.
  *
  * @description
  * Change the opacity of an object in the scene.
  * ```js
  * viewer.setTransparency(0.5, {
  *   shape_name: "shape1"
  * });
  * ```
  */
  viewer.setTransparency = function(alpha, options) {
    options = options || {};

    var shape_name = options.shape_name;
    var shape = viewer.model.getObjectByName(shape_name);
    var shapes, material, wireframe;

    if (shape) {
      shapes = [shape];
    } else {
      shapes = viewer.model.children || [];
    }

    shapes.forEach(function(shape) {
      material = shape.material;
      material.opacity = alpha;
      
      if (alpha === 1) {
        material.transparent = false;
      } else {
        material.transparent = true;
      }

      wireframe = shape.getObjectByName("__WIREFRAME__");
      if (wireframe) {
        wireframe.material.opacity = material.opacity;
        wireframe.material.transparent = material.transparent;
      }
    });
    
    viewer.updated = true;
  };

  /**
  * @doc function
  * @name viewer.views:setWireframe
  * @param {boolean} is_wireframe Is the viewer in wireframe mode?
  * @param {objects} options currently the only supported option is **shape_name**
  *   which causes only the wireframe shape with the given name to be toggled.
  *
  * @description
  * Change the opacity of an object in the scene.
  * ```js
  * viewer.setWireframe(true, {
  *   shape_name: "shape1"
  * });
  * ```
  */
  viewer.setWireframe = function(is_wireframe, options) {
    options = options || {};

    var shape_name = options.shape_name;
    var shape = viewer.model.getObjectByName(shape_name);
    var shapes, wireframe;
    
    if (shape) {
      shapes = [shape];
    } else {
      shapes = viewer.model.children || [];
    }

    shapes.forEach(function(shape) {
      wireframe = shape.getObjectByName("__WIREFRAME__");
      if (wireframe) {
        toggleWireframe(shape, wireframe, is_wireframe);
      } else if (shape.has_wireframe) {
        createWireframe(shape, function(wireframe) {
          toggleWireframe(shape, wireframe, is_wireframe);
        });
      }
    });
  };

  /**
  * @doc function
  * @name viewer.views:setView
  * @param {string} view_name The name of the view to change to.
  * @description
  * Change to a given view of a split data set. (**Note:** this is
  * only effective for a split dataset, e.g. two hemispheres of a brain).
  * ```js
  * viewer.setView("lateral");
  * ```
  */
  viewer.setView = function(view_name, model_name) {
    var method_name = view_name + "View";
    var model_data = viewer.model_data.get(model_name);

    viewer.resetView();

    if(model_data && BrainBrowser.utils.isFunction(views[method_name])) {
      views[method_name](model_data);
    }

    viewer.updated = true;
  };

  /**
  * @doc function
  * @name viewer.views:separateHalves
  * @param {number} increment Amount of space to put between halves.
  * @description
  * Add space between two halves of a split dataset. (**Note:** this is
  * only effective for a split dataset, e.g. two hemispheres of a brain).
  * ```js
  * viewer.separateHalves(1.5);
  * ```
  *
  * If more than one model file has been loaded, refer to the appropriate
  * model using the **model_name** option:
  * ```js
  * viewer.separateHalves(1.5, { model_name: "brain.obj" });
  * ```
  */
  viewer.separateHalves = function(increment, options) {
    increment = increment || 1;
    options = options || {};

    if(viewer.model_data.get(options.model_name).split ) {
      viewer.model.children[0].position.x -= increment;
      viewer.model.children[1].position.x += increment;
    }

    viewer.updated = true;
  };

  ////////////////////////////////////
  // PRIVATE FUNCTIONS
  ////////////////////////////////////

  function createWireframe(shape, callback) {
    var worker = new Worker(BrainBrowser.SurfaceViewer.worker_urls.wireframe);
    var geometry = shape.geometry.attributes;

    worker.addEventListener("message", function(event) {
      var positions = event.data.positions;
      var colors = event.data.colors;

      var wire_geometry = new THREE.BufferGeometry();
      var material, wireframe;

      wire_geometry.attributes.position = {
        itemSize: 3,
        array: positions,
        numItems: positions.length
      };

      wire_geometry.attributes.color = {
        itemSize: 4,
        array: colors,
      };

      wire_geometry.attributes.color.needsUpdate = true;

      material = new THREE.LineBasicMaterial({ vertexColors: THREE.VertexColors });
      wireframe = new THREE.Line(wire_geometry, material, THREE.LinePieces);

      wireframe.name = "__WIREFRAME__";
      wireframe.visible = false;
      shape.wireframe_active = false;
      shape.add(wireframe);
      callback(wireframe);
    });

    worker.postMessage({
      positions: geometry.position.array,
      colors: geometry.color.array,
    });
  }

  function toggleWireframe(shape, wireframe, is_wireframe) {
    shape.visible = !is_wireframe;
    wireframe.visible = is_wireframe;
    shape.wireframe_active = is_wireframe;
    viewer.updated = true;
  }
  
};

