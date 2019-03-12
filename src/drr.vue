<template>
  <div class="drr" :style="style"
       :class="classObject"
       @dblclick="dblclick($event)"
       @mousedown="bodyMouseDown($event)"
       @touchstart.stop.prevent="bodyMouseDown($event)">
    <slot></slot>
    <div
      v-for="stick in sticks"
      class="drr-stick"
      :class="['drr-stick-' + stick, resizable ? '' : 'not-resizable']"
      @mousedown.stop.prevent="stickDown(stick, $event)"
      @touchstart.stop.prevent="stickDown(stick, $event)"
      :style="drrStick(stick)">
    </div>
    <div class="ro-stick-handle" v-if="rotatable"></div>
  </div>
</template>

<script>
  import Vector from '@minogin/vector'

  const _ = require('lodash');

  const stickSize = 8;
  const roStickSize = 20;
  const styleMapping = {
    y: {
      t: 'top',
      m: 'marginTop',
      b: 'bottom',
    },
    x: {
      l: 'left',
      m: 'marginLeft',
      r: 'right',
    }
  };

  export default {
    name: 'drr',
    props: {
      x: {
        type: Number,
        required: true,
        validator: function (val) {
          return typeof val === 'number'
        }
      },
      y: {
        type: Number,
        required: true,
        validator: function (val) {
          return typeof val === 'number'
        }
      },
      w: {
        type: Number,
        required: true,
        validator: function (val) {
          return val > 0
        }
      },
      h: {
        type: Number,
        required: true,
        validator: function (val) {
          return val > 0
        }
      },
      angle: {
        type: Number,
        default: 0,
        validator: function (val) {
          return typeof val === 'number'
        }
      },
      selected: {
        type: Boolean,
        default: false
      },
      selectable: {
        type: Boolean,
        default: true
      },
      draggable: {
        type: Boolean,
        default: true
      },
      resizable: {
        type: Boolean,
        default: true
      },
      rotatable: {
        type: Boolean,
        default: true
      },
      hasActiveContent: {
        type: Boolean,
        default: false
      },
      aspectRatio: {
        type: Boolean,
        default: false
      },
      dragHandle: {
        type: String,
        default: null
      },
      dragCancel: {
        type: String,
        default: null
      },
      outerBound: {
        type: Object
      },
      innerBound: {
        type: Object
      },
      dragHandler: {
        type: Function
      },
      resizeHandler: {
        type: Function
      }
    },

    data: function () {
      return {
        active: this.selected,
        contentActive: false,
        cx: this.x,
        cy: this.y,
        width: this.w,
        height: this.h,
        rotation: this.angle,
        bodyDrag: false,
        dragged: false,
        resized: false,
        rotated: false
      }
    },

    computed: {
      sticks() {
        let sticks = []
        if (this.resizable)
          sticks.push('tl', 'tr', 'br', 'bl')
        if (this.rotatable)
          sticks.push('ro')
        return sticks
      },

      classObject() {
        return {
          'active': this.active,
          'inactive': !this.active,
          'selectable': this.selectable,
          'non-selectable': !this.selectable,
          'dragging': this.bodyDrag,
          'content-active': this.contentActive
        }
      },

      style() {
        return {
          left: (this.cx - this.width / 2) + 'px',
          top: (this.cy - this.height / 2) + 'px',
          width: this.width + 'px',
          height: this.height + 'px',
          transform: 'rotate(' + this.rotation + 'deg)'
        }
      },

      drrStick() {
        return (stick) => {
          const stickStyle = {
            width: `${stickSize}px`,
            height: `${stickSize}px`,
          };
          if (stick == 'ro') {
            stickStyle['top'] = `${-stickSize / 2 - roStickSize}px`;
            stickStyle['marginLeft'] = `${-stickSize / 2 + 1}px`;
          }
          else {
            stickStyle[styleMapping.y[stick[0]]] = `${-stickSize / 2}px`;
            stickStyle[styleMapping.x[stick[1]]] = `${-stickSize / 2}px`;
          }
          return stickStyle;
        }
      },
    },

    watch: {
      active(val) {
        if (val)
          this.$emit('select');
        else
          this.$emit('deselect');
      },

      selected(val) {
        this.active = val
      },

      hasActiveContent: {
        handler: function(val) {
          if (val) {
            this.$on('content-active', this.onContentActive)
            this.$on('content-inactive', this.onContentInactive)
          }
          else {
            this.$off('content-active')
            this.$off('content-inactive')
            if (this.contentActive)
              this.onContentInactive()
          }
        },
        immediate: true
      },

      x() {
        if (this.stickDrag || this.bodyDrag)
          return

        this.cx = this.x
      },

      y() {
        if (this.stickDrag || this.bodyDrag)
          return

        this.cy = this.y
      },

      w() {
        if (this.stickDrag || this.bodyDrag)
          return

        this.currentStick = ['m', 'r'];

        this.width = this.w
      },

      h() {
        if (this.stickDrag || this.bodyDrag)
          return

        this.currentStick = ['b', 'm'];

        this.height = this.h
      },

      angle() {
        if (this.stickDrag || this.bodyDrag)
          return

        this.rotation = this.angle
      }
    },

    created: function () {
      this.stickDrag = false;
      this.bodyDrag = false;
      this.stickStartPos = { mouseX: 0, mouseY: 0, x: 0, y: 0, w: 0, h: 0 };

      this.currentStick = [];
    },

    mounted: function () {
      this.parentElement = this.$el.parentNode;
      // this.parentWidth = this.parentW ? this.parentW : this.parentElement.clientWidth;
      // this.parentHeight = this.parentH ? this.parentH : this.parentElement.clientHeight;

      document.documentElement.addEventListener('mousemove', this.move);
      document.documentElement.addEventListener('mouseup', this.up);
      document.documentElement.addEventListener('mouseleave', this.up);

      document.documentElement.addEventListener('mousedown', this.deselect);

      document.documentElement.addEventListener('touchmove', this.move, true);
      document.documentElement.addEventListener('touchend touchcancel', this.up, true);
      document.documentElement.addEventListener('touchstart', this.up, true);

      if (this.dragHandle) {
        let dragHandles = Array.prototype.slice.call(this.$el.querySelectorAll(this.dragHandle));
        for (let i in dragHandles) {
          dragHandles[i].setAttribute('data-drag-handle', this._uid);
        }
      }

      if (this.dragCancel) {
        let cancelHandles = Array.prototype.slice.call(this.$el.querySelectorAll(this.dragCancel));
        for (let i in cancelHandles) {
          cancelHandles[i].setAttribute('data-drag-cancel', this._uid);
        }
      }
    },

    beforeDestroy: function () {
      document.documentElement.removeEventListener('mousemove', this.move);
      document.documentElement.removeEventListener('mouseup', this.up);
      document.documentElement.removeEventListener('mouseleave', this.up);

      document.documentElement.removeEventListener('mousedown', this.deselect);

      document.documentElement.removeEventListener('touchmove', this.move, true);
      document.documentElement.removeEventListener('touchend touchcancel', this.up, true);
      document.documentElement.removeEventListener('touchstart', this.up, true);
    },

    methods: {
      getRect() {
        return {
          x: this.cx,
          y: this.cy,
          w: this.width,
          h: this.height,
          angle: this.rotation
        }
      },

      setRect(r) {
        this.cx = r.x
        this.cy = r.y
        this.width = r.w
        this.height = r.h
        this.angle = r.angle
      },

      dblclick(e) {
        if (!this.selectable)
          return

        this.$emit('content-active')
      },

      onContentActive() {
        this.contentActive = true
        this.active = false
        for (const child of this.$children) {
          child.$emit('active')
        }
      },

      onContentInactive() {
        this.contentActive = false
        this.active = true
        for (const child of this.$children) {
          child.$emit('inactive')
        }
      },

      deselect() {
        this.$emit('deselect')
        this.active = false
      },

      move(ev) {
        if (!this.stickDrag && !this.bodyDrag) {
          return
        }

        ev.stopPropagation();

        if (this.stickDrag) {
          this.stickMove(ev);
        }
        if (this.bodyDrag) {
          this.bodyMove(ev)
        }
      },

      up(ev) {
        if (this.stickDrag) {
          this.stickUp(ev);
        }
        if (this.bodyDrag) {
          this.bodyUp(ev)
        }
      },

      bodyMouseDown: function (e) {
        if (this.contentActive || !this.selectable) {
          return
        }
        else {
          e.preventDefault()
          e.stopPropagation()
        }

        let target = e.target || e.srcElement;

        this.active = true;

        if (e.button && e.button !== 0) {
          return
        }

        this.$emit('clicked', e);

        if (!this.draggable || !this.active) {
          return
        }

        if (this.dragHandle && target.getAttribute('data-drag-handle') !== this._uid.toString()) {
          return
        }

        if (this.dragCancel && target.getAttribute('data-drag-cancel') === this._uid.toString()) {
          return
        }

        this.bodyDrag = true
        this.dragged = false

        this.dragStartEmitted = false
        this.startRect = _.cloneDeep(this.getRect())

        this.stickStartPos.mouseX = e.pageX || e.touches[0].pageX
        this.stickStartPos.mouseY = e.pageY || e.touches[0].pageY

        this.stickStartPos.cx = this.cx
        this.stickStartPos.cy = this.cy
      },

      bodyMove(ev) {
        const stickStartPos = this.stickStartPos;

        const newPos = {
          mouseX: ev.pageX || ev.touches[0].pageX,
          mouseY: ev.pageY || ev.touches[0].pageY
        }
        const delta = {
          x: newPos.mouseX - stickStartPos.mouseX,
          y: newPos.mouseY - stickStartPos.mouseY
        }

        let newcx = stickStartPos.cx + delta.x
        let newcy = stickStartPos.cy + delta.y
        let x1 = newcx - this.width / 2
        let y1 = newcy - this.height / 2
        let x2 = newcx + this.width / 2
        let y2 = newcy + this.height / 2

        if (this.outerBound && this.rotation == 0) {
          let bx1 = this.outerBound.x - this.outerBound.w / 2
          let by1 = this.outerBound.y - this.outerBound.h / 2
          let bx2 = this.outerBound.x + this.outerBound.w / 2
          let by2 = this.outerBound.y + this.outerBound.h / 2
          if (x1 < bx1)
            delta.x -= x1 - bx1
          if (x2 > bx2)
            delta.x -= x2 - bx2
          if (y1 < by1)
            delta.y -= y1 - by1
          if (y2 > by2)
            delta.y -= y2 - by2
        }

        if (this.innerBound && this.rotation == 0) {
          let bx1 = this.innerBound.x - this.innerBound.w / 2
          let by1 = this.innerBound.y - this.innerBound.h / 2
          let bx2 = this.innerBound.x + this.innerBound.w / 2
          let by2 = this.innerBound.y + this.innerBound.h / 2
          if (x1 > bx1)
            delta.x -= x1 - bx1
          if (x2 < bx2)
            delta.x -= x2 - bx2
          if (y1 > by1)
            delta.y -= y1 - by1
          if (y2 < by2)
            delta.y -= y2 - by2
        }

        this.cx = stickStartPos.cx + delta.x
        this.cy = stickStartPos.cy + delta.y

        if (this.dragHandler)
          this.setRect(this.dragHandler(this.getRect()))

        if (!this.dragStartEmitted) {
          this.$emit('dragstart', this.startRect);
          this.dragStartEmitted = true
        }

        this.dragged = true
        this.$emit('drag', this.getRect());
      },

      bodyUp() {
        this.bodyDrag = false;
        if (this.dragged) {
          this.$emit('dragstop', this.getRect(), this.startRect);
          this.$emit('change', this.getRect());
        }

        this.stickStartPos = { mouseX: 0, mouseY: 0, x: 0, y: 0, w: 0, h: 0 };
      },

      stickDown: function (stick, ev) {
        if (!this.resizable || !this.active)
          return

        this.resizeStartEmitted = false
        this.rotateStartEmitted = false
        this.startRect = _.cloneDeep(this.getRect())

        this.stickDrag = true;
        this.resized = false
        this.rotated = false
        this.stickStartPos.mouseX = ev.pageX || ev.touches[0].pageX;
        this.stickStartPos.mouseY = ev.pageY || ev.touches[0].pageY;
        this.stickStartPos.cx = this.cx;
        this.stickStartPos.cy = this.cy;
        this.stickStartPos.width = this.width;
        this.stickStartPos.height = this.height;
        this.stickStartPos.rotation = this.rotation;
        this.currentStick = stick
      },

      stickMove(ev) {
        const stickStartPos = this.stickStartPos;

        let delta = new Vector(
          (ev.pageX || ev.touches[0].pageX) - stickStartPos.mouseX,
          (ev.pageY || ev.touches[0].pageY) - stickStartPos.mouseY
        )


        if (this.currentStick == 'ro') {
          let up = new Vector(0, -(this.height) / 2 - roStickSize)
          let rotationRad = Vector.rad(stickStartPos.rotation);
          up = up.rotate(rotationRad)
          let v = up.add(delta)

          if (!this.rotateStartEmitted) {
            this.$emit('rotatestart', this.startRect);
            this.rotateStartEmitted = true
          }

          this.rotation = Vector.deg(v.angle()) + 90
          this.rotated = true
          this.$emit('rotate', this.getRect());
        }
        else {
          let dirX = this.currentStick[1] == 'r' ? 1 : -1
          let dirY = this.currentStick[0] == 'b' ? 1 : -1

          let phi = Vector.rad(stickStartPos.rotation);
          let p
          if (this.aspectRatio) {
            let axis = new Vector(dirX * stickStartPos.width / 2, dirY * stickStartPos.height / 2)
            axis = axis.rotate(phi).unit()
            p = axis.mul(axis.mul(delta))
          }
          else {
            p = delta
          }

          let pn = p.rotate(-phi)

          let newcx = stickStartPos.cx + p.x / 2
          let newcy = stickStartPos.cy + p.y / 2
          let newwidth = stickStartPos.width + dirX * pn.x
          let newheight = stickStartPos.height + dirY * pn.y
          let x1 = newcx - newwidth / 2
          let y1 = newcy - newheight / 2
          let x2 = newcx + newwidth / 2
          let y2 = newcy + newheight / 2

          if (this.outerBound && this.rotation == 0) {
            let bx1 = this.outerBound.x - this.outerBound.w / 2
            let by1 = this.outerBound.y - this.outerBound.h / 2
            let bx2 = this.outerBound.x + this.outerBound.w / 2
            let by2 = this.outerBound.y + this.outerBound.h / 2
            let dx = 0
            let dy = 0
            if (x1 < bx1)
              dx = bx1 - x1
            if (x2 > bx2)
              dx = bx2 - x2
            if (y1 < by1)
              dy = by1 - y1
            if (y2 > by2)
              dy = by2 - y2

            if (dx != 0 || dy != 0) {
              if (this.aspectRatio) {
                if (dx / p.x < dy / p.y) {
                  p.y += dx * p.y / p.x
                  p.x += dx
                }
                else {
                  p.x += dy * p.x / p.y
                  p.y += dy
                }
              }
              else {
                p.x += dx
                p.y += dy
              }
            }
          }

          if (this.innerBound && this.rotation == 0) {
            let bx1 = this.innerBound.x - this.innerBound.w / 2
            let by1 = this.innerBound.y - this.innerBound.h / 2
            let bx2 = this.innerBound.x + this.innerBound.w / 2
            let by2 = this.innerBound.y + this.innerBound.h / 2
            let dx = 0
            let dy = 0
            if (x1 > bx1)
              dx = bx1 - x1
            if (x2 < bx2)
              dx = bx2 - x2
            if (y1 > by1)
              dy = by1 - y1
            if (y2 < by2)
              dy = by2 - y2

            if (dx != 0 || dy != 0) {
              if (this.aspectRatio) {
                if (dx / p.x < dy / p.y) {
                  p.y += dx * p.y / p.x
                  p.x += dx
                }
                else {
                  p.x += dy * p.x / p.y
                  p.y += dy
                }
              }
              else {
                p.x += dx
                p.y += dy
              }
            }
          }

          this.cx = stickStartPos.cx + p.x / 2
          this.cy = stickStartPos.cy + p.y / 2
          pn = p.rotate(-phi)
          this.width = stickStartPos.width + dirX * pn.x
          this.height = stickStartPos.height + dirY * pn.y

          if (this.resizeHandler)
            this.setRect(this.resizeHandler(this.getRect()))

          if (!this.resizeStartEmitted) {
            this.$emit('resizestart', this.startRect);
            this.resizeStartEmitted = true
          }

          this.resized = true
          this.$emit('resize', this.getRect());
        }
      },

      stickUp() {
        this.stickDrag = false;
        this.stickStartPos = {
          mouseX: 0,
          mouseY: 0,
          x: 0,
          y: 0,
          w: 0,
          h: 0
        };

        if (this.resized) {
          this.$emit('resizestop', this.getRect(), this.startRect);  // TODO
          this.$emit('change', this.getRect());
        }

        if (this.rotated) {
          this.$emit('rotatestop', this.getRect(), this.startRect);
          this.$emit('change', this.getRect());
        }
      },
    },
  }

</script>

<style scoped>
  /*TODO less */

  .drr {
    position: absolute;
    box-sizing: border-box;
    cursor: pointer;
  }

  .drr.active:before {
    content: '';
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    box-sizing: border-box;
    outline: 2px dashed lightskyblue;
  }

  .drr.selectable.inactive:hover:before {
    content: '';
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    box-sizing: border-box;
    outline: 2px dashed #d6d6d6;
  }

  .drr.non-selectable {
    pointer-events: none;
  }

  .drr-stick {
    box-sizing: border-box;
    position: absolute;
    font-size: 1px;
    background: #ffffff;
    border: 1px solid #6c6c6c;
    box-shadow: 0 0 2px #bbb;
  }

  .drr-stick:hover {
    border-color: lightskyblue;
  }

  .inactive > .drr-stick {
    display: none;
  }

  .drr-stick-tl, .drr-stick-br {
    cursor: nwse-resize;
  }

  .drr-stick-tm, .drr-stick-bm {
    left: 50%;
    cursor: ns-resize;
  }

  .drr-stick-tr, .drr-stick-bl {
    cursor: nesw-resize;
  }

  .drr-stick-ml, .drr-stick-mr {
    top: 50%;
    cursor: ew-resize;
  }

  .drr-stick-ro {
    left: 50%;
    cursor: ew-resize;
    border-radius: 4px;
  }

  .ro-stick-handle {
    left: 50%;
    top: -16px;
    box-sizing: border-box;
    position: absolute;
    font-size: 1px;
    background: #ffffff;
    border: 1px solid #6c6c6c;
    box-shadow: 0 0 2px #bbb;
    width: 0px;
    height: 16px;
  }

  .inactive > .ro-stick-handle {
    display: none;
  }

  .drr-stick.not-resizable {
    display: none;
  }

  .content-active {
    border: 2px solid lightskyblue; /*TODO*/
  }
</style>
