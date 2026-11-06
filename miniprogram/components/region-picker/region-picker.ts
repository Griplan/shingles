import { BodyRegion } from "../../types/dermatome";

Component({
  properties: {
    open:{type:Boolean,value:false},
    viewLabel:{type:String,value:"正面"},
    regions:{type:Array,value:[] as BodyRegion[]},
    selected:{type:String,value:""},
    candidatesOnly:{type:Boolean,value:false},
  },
  methods: {
    close() { this.triggerEvent("close"); },
    choose(event:WechatMiniprogram.TouchEvent) {
      const id:unknown=event.currentTarget.dataset.id;
      if(this.properties.open && typeof id==="string" && this.properties.regions.some(r=>r.id===id)) {
        this.triggerEvent("choose",{id});
      }
    },
    stopTouch() { /* 只阻止弹层事件冒泡，不拦截整个页面。 */ },
  },
});
