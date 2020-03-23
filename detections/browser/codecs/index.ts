import IDetectionPlugin from '@double-agent/runner/interfaces/IDetectionPlugin';
import IRequestContext from '@double-agent/runner/interfaces/IRequestContext';
import { saveUseragentProfile } from '@double-agent/runner/lib/profileHelper';
import { cleanProfile, convertWebRtcCodecsToString, getProfileForUa } from './lib/CodecProfile';
import ICodecSupport from './interfaces/ICodecSupport';
import codecPageScript from './codecPageScript';
import ICodecProfile from './interfaces/ICodecProfile';
import IFlaggedCheck from '@double-agent/runner/interfaces/IFlaggedCheck';
import ResourceType from '@double-agent/runner/interfaces/ResourceType';

export default class BrowserCodecsPlugin implements IDetectionPlugin {
  private static pluginName = 'browser/codecs';
  public async onRequest(ctx: IRequestContext) {
    // only load on the secure domain
    if (
      !ctx.session.pluginsRun.includes(BrowserCodecsPlugin.pluginName) &&
      ctx.requestDetails.resourceType === ResourceType.Document
    ) {
      ctx.extraScripts.push(codecPageScript(ctx));
    }
  }

  public async handleResponse(ctx: IRequestContext): Promise<boolean> {
    const requestUrl = ctx.url;
    if (requestUrl.pathname === '/codecs') {
      const res = ctx.res;
      const agentProfile = cleanProfile(
        ctx.requestDetails.useragent,
        ctx.requestDetails.bodyJson as ICodecProfile,
      );

      if (process.env.GENERATE_PROFILES) {
        saveUseragentProfile(agentProfile.useragent, agentProfile, __dirname + '/profiles');
      }
      this.checkProfile(ctx, agentProfile);

      if (ctx.req.headers.origin) {
        res.setHeader('Access-Control-Allow-Origin', ctx.req.headers.origin);
      } else if (ctx.req.headers.referer) {
        res.setHeader('Access-Control-Allow-Origin', new URL(ctx.req.headers.referer).origin);
      }
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'X-Content-Type-Options': 'nosniff',
      });

      res.end(JSON.stringify({ success: true }));
      return true;
    }
    return false;
  }

  private checkProfile(ctx: IRequestContext, agentProfile: ICodecProfile) {
    const browserProfile = getProfileForUa(agentProfile.useragent);
    if (!browserProfile) return;

    for (const support of ['audio', 'video']) {
      const title = support.charAt(0).toUpperCase() + support.slice(1);
      const agentCodecSupport = agentProfile[support + 'Support'] as ICodecSupport;
      const expectedAgentCodecSupport = browserProfile[support + 'Support'] as ICodecSupport;

      const codecEntry = {
        category: `${title} Codecs Supported`,
        description: `Checks that the browser agent supports the ${title} codecs found in a default installation`,
        requestIdx: ctx.session.requests.indexOf(ctx.requestDetails),
        layer: 'browser',
        hostDomain: ctx.requestDetails.hostDomain,
        resourceType: ctx.requestDetails.resourceType,
      } as IFlaggedCheck;

      for (const entry of [
        ['probablyPlays', '"Probably" Playback'],
        ['maybePlays', '"Maybe" Playback'],
        ['recordingFormats', 'Recording'],
      ]) {
        const [property, name] = entry;
        const provided = agentCodecSupport[property];
        const expected = expectedAgentCodecSupport[property];
        const checkName = `${title} ${name} Codecs`;
        ctx.session.recordCheck(!expected.every(x => provided.includes(x)), {
          ...codecEntry,
          pctBot: 99,
          value: provided.toString(),
          expected: expected.toString(),
          checkName,
        });
      }

      const expected = convertWebRtcCodecsToString(browserProfile[`webRtc${title}Codecs`]);
      const value = convertWebRtcCodecsToString(agentProfile[`webRtc${title}Codecs`]);

      ctx.session.recordCheck(expected !== value, {
        ...codecEntry,
        pctBot: 70,
        category: `WebRTC ${title} Codecs Supported`,
        checkName: `WebRTC ${title} MimeTypes and ClockRate Match`,
        value,
        expected,
      });
      ctx.session.pluginsRun.push('browser/codecs');
    }
  }
}
