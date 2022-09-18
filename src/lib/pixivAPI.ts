import CryptoJS from 'crypto-js';
import fetch from "node-fetch";
import { SocksProxyAgent } from "socks-proxy-agent";

const clientId = "MOBrBDS8blbauoSck0ZfDbtuzpyT";
const clientSecret = "lsACyCD94FhDUtGTXi3QzcFE2uU1hqtDaKeqrdwj";
const hashSecret = "28c1fdd170a5204386cb1313c7077b34f83e4aaf4aa829ce78c231e05b0bae2c";
const agent = new SocksProxyAgent({ hostname: "127.0.0.1", port: 23333 });
const timeout = 3000;

export async function pixivGetAccessToken(_refreshToken?: string) {
    const accessToken = (await redis.hGet("token", "accessToken"));
    if (accessToken) {
        return accessToken;
    } else {
        const refreshToken = _refreshToken || (await redis.hGet("config", "refreshToken"));
        if (!refreshToken) throw new Error("not login! use 'l [refreshToken]' to login");
        const token = await pixivLogin(refreshToken);
        if (!token || token.error) {
            log.error(`未成功登录`, token);
            return;
        }
        redis.hSet("token", "accessToken", token.access_token);
        redis.hSet("token", "refreshToken", token.refresh_token);
        redis.expire("token", token.expires_in);
        redis.hSet("config", "refreshToken", token.refresh_token);
        log.debug(`已刷新token并保存在数据库中\naccessToken: ${token.access_token}\nrefreshToken: ${token.refresh_token}\n过期时间: ${token.expires_in}`);
        return token.access_token;
    }
    return;
}

export async function pixivLogin(code: string) {
    //2022-09-17T15:06:39+00:00
    const tC = (t: number) => { return t.toString().padStart(2, "0") };
    const nowTime = new Date();

    const localTime = `${nowTime.getUTCFullYear()}-${nowTime.getUTCMonth() + 1}-${nowTime.getUTCDate()}` +
        `T` +
        `${tC(nowTime.getUTCHours())}:${tC(nowTime.getUTCMinutes())}:${tC(nowTime.getUTCSeconds())}` +
        `+00:00`;

    const headers = {
        "App-OS": "android",
        "App-OS-Version": "12.0.0",
        "App-Version": "5.0.235",
        "User-Agent": "PixivAndroidApp/5.0.235 (Android 12.0.0; Android SDK built for x64)",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Referer": "https://app-api.pixiv.net/",
        'X-Client-Time': localTime,
        'X-Client-Hash': CryptoJS.MD5(localTime + hashSecret).toString(),//md5(localTime + hashSecret, { encoding: "utf8" }),
    }

    const postObj = new URLSearchParams();
    postObj.set("client_id", clientId);
    postObj.set("client_secret", clientSecret);
    postObj.set("include_policy", "true");

    // postObj.set("redirect_uri", "https://app-api.pixiv.net/web/v1/users/auth/pixiv/callback");
    // postObj.set("grant_type", "authorization_code");
    // postObj.set("code", code);
    postObj.set("grant_type", "refresh_token");
    postObj.set("refresh_token", code);
    //postObj.set("code_verifier", verifier());

    return await fetch(`https://oauth.secure.pixiv.net/auth/token`, {
        method: "POST",
        body: postObj.toString(),
        headers,
        timeout,
        agent
    }).then((res) => {
        /* log.debug(res.status);
        log.debug(res.statusText); */
        return res.json();
    }).then().then((res: PixivLoginedData) => {
        return res;
    }).catch(err => {
        log.error(err);
    });
}

export async function pixivSearchIllust(_params: SearchParams): Promise<PixivSearchData | null> {

    const params = new URLSearchParams({
        word: _params.word,
        search_target: _params.search_target,
        sort: _params.sort,
        filter: "for_ios",
    });
    if (_params.start_date) params.set("start_date", _params.start_date);
    if (_params.end_date) params.set("end_date", _params.end_date);
    if (_params.duration) params.set("duration", _params.duration);
    if (_params.offset) params.set("offset", _params.offset.toString());
    //log.debug(params.toString());

    const accessToken = await pixivGetAccessToken();
    if (!accessToken) throw new Error("not login! use 'l [refreshToken]' to login");

    return fetch(`https://app-api.pixiv.net/v1/search/illust?${params.toString()}`, {
        headers: {
            "App-OS": "android",
            "App-OS-Version": "12.0.0",
            "App-Version": "5.0.235",
            "User-Agent": "PixivAndroidApp/5.0.235 (Android 12.0.0; Android SDK built for x64)",
            "Authorization": `Bearer ${accessToken}`,
        },
        method: "GET",
        timeout,
        agent
    }).then(res => {
        return res.json();
    }).then((json: PixivSearchData) => {
        return json;
    });
}

interface SearchParams {
    word: string;
    search_target: "partial_match_for_tags" | "exact_match_for_tags" | "title_and_caption"; // 标签部分一致 / 标签完全一致 / 标题说明文
    sort: "date_desc" | "date_asc" | "popular_desc";//popular_desc为会员的热门排序
    filter?: "for_ios";
    duration?: "within_last_day" | "within_last_week" | "within_last_month";
    start_date?: string;
    end_date?: string;
    offset?: number;
}

/* interface PixivLoginData {
    client_id: string;
    client_secret: string;
    get_secure_url: '1';
    grant_type?: string;    //"password" | "refresh_token";
    username?: string;      //grant_type==password
    password?: string;      //grant_type==password
    refresh_token?: string; //grant_type==refresh_token
} */
interface PixivLoginedData {
    access_token: string;
    expires_in: number;
    token_type: string;
    scope: string;
    refresh_token: string;
    user: {
        profile_image_urls: {
            px_16x16: string;
            px_50x50: string;
            px_170x170: string;
        };
        id: string;
        name: string;
        account: string;
        mail_address: string;
        is_premium: boolean;
        x_restrict: number;
        is_mail_authorized: boolean;
        require_policy_agreement: boolean;
    };
    response?: PixivLoginedData;

    error?: string;
    errors?: {
        system: {
            message: string;
            code: string;
        };
    };
}

interface PixivSearchData {
    illusts?: PixivIllust[];
    next_url?: string;
    search_span_limit?: number;
    error?: {
        user_message: string;
        message: string;
        reason: string;
        user_message_details: {};
    };
}

export interface PixivIllust {
    id: number;
    title: string;
    type: Type;
    image_urls: PixivImageUrls;
    caption: string;
    restrict: number;
    user: {
        id: number;
        name: string;
        account: string;
        profile_image_urls: {
            medium: string;
        };
        is_followed: boolean;
    };
    tags: {
        name: string;
        translated_name: null;
    }[];
    tools: string[];
    create_date: Date;
    page_count: number;
    width: number;
    height: number;
    sanity_level: number;
    x_restrict: number;
    series: null;
    meta_single_page: {
        original_image_url?: string;
    };
    meta_pages: {
        image_urls: PixivImageUrls;
    }[];
    total_view: number;
    total_bookmarks: number;
    is_bookmarked: boolean;
    visible: boolean;
    is_muted: boolean;
}

interface PixivImageUrls {
    square_medium: string;
    medium: string;
    large: string;
    original: string;
}

export enum Type {
    Illust = "illust",
    Manga = "manga",
}