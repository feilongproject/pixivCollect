import { pixivSearchIllust, pixivGetAccessToken } from '../lib/pixivAPI';


export async function search(keywords: string[]) {
    const keyword = keywords[0];

    if (!keywords[0]) {
        log.error(`未找到关键词，请重试！`);
        return;
    }
    log.info(`正在搜索关键词：${keywords[0]}`);

    const data = await pixivSearchIllust({
        word: keyword,
        search_target: "partial_match_for_tags",
        sort: "date_desc",
    }).catch(err => {
        log.error(err);
    });
    if (!(data && data.illusts)) {
        log.error(`未找到有关信息`);
        return;
    }

    const queue: Promise<any>[] = [];
    const stst = {
        databaseHas: (await picRedis.keys(`pid:*`)).length,
        databasePut: 0,
        searchCount: data.illusts.length,
    };

    for (const [index, illust] of data.illusts.entries()) {
        queue.push(picRedis.exists(`pid:${illust.id}`).then(has => {
            if (has == 1) {
                log.info(`已找到第${index}张，id：${illust.id}，总页数：${illust.page_count}，已置入数据库`);
            } else {
                log.info(`已找到第${index}张，id：${illust.id}，总页数：${illust.page_count}，正在置入数据库中`);
                stst.databasePut++;
                stst.databaseHas++;
                const tags: string[] = [];
                for (const tag of illust.tags) {
                    tags.push(tag.name);
                }
                const metaPages: {
                    original?: string;
                    /* square_medium: string;
                    medium: string;
                    large: string; */
                }[] = [];
                if ((illust.page_count == 1) && illust.meta_single_page.original_image_url) {
                    metaPages.push({ original: illust.meta_single_page.original_image_url });
                } else {
                    for (const page of illust.meta_pages) metaPages.push(page.image_urls);


                }
                return picRedis.hSet(`pid:${illust.id}`, [
                    ["id", illust.id],
                    ["title", illust.title],
                    ["type", illust.type],
                    ["caption", illust.caption],
                    ["user:id", illust.user.id],
                    ["user:name", illust.user.name],
                    ["user:account", illust.user.account],
                    ["tags", tags.join()],
                    ["create_date", new Date(illust.create_date).getTime()],
                    ["page_count", illust.page_count],
                    ["sanity_level", illust.sanity_level],
                    ["meta_pages", JSON.stringify(illust.meta_pages)],
                    ["total_view", illust.total_view],
                    ["total_bookmarks", illust.total_bookmarks],
                ]);
            }
        }));
    }

    await Promise.all(queue);
    log.info(`本次查找已找到${stst.searchCount}张，已向数据库添加${stst.databasePut}张，数据库总计共有${stst.databaseHas}张`);

}

export async function login(keyword: string[]) {

    const refreshToken = keyword[0];
    if (!refreshToken) {
        log.error("code为空，请输入完整后重试！");
        return;
    }
    const token = await pixivGetAccessToken(refreshToken).catch(err => {
        log.error(err);
    });
    if (!token) {
        log.error(`未成功登录`);
        return;
    }

}
//\u4e0d\u6b63\u306a\u30ea\u30af\u30a8\u30b9\u30c8\u3067\u3059\u3002
//不正なリクエストです