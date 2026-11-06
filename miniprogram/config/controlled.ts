import {currentEnvironment} from "./environment";
/** User-entered test credential stays in memory; never package or persist it. */
let key="";
export const CONTROLLED_SIMULATOR_URL="http://127.0.0.1:18001";
export function useControlledServer(value:string):void {
 if(!/^[A-Za-z0-9_-]{32,128}$/.test(value))throw new Error("访问凭据格式不正确");
 if(wx.getSystemInfoSync().platform!=="devtools"||wx.getAccountInfoSync().miniProgram.envVersion!=="develop")throw new Error("当前仅支持开发工具中的受控联调");
 key=value;
}
export function clearControlledServer():void {key="";}
export function controlledServerActive():boolean {try{return !!key&&currentEnvironment()==="develop"&&wx.getSystemInfoSync().platform==="devtools";}catch{return false;}}
export function accessHeaders():Record<string,string> {return controlledServerActive()?{"x-test-access-key":key}:{};}
