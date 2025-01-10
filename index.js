const ytdl = require("@distube/ytdl-core");

const { httpRequest } = require("./http-request");
const { WebVTTParser } = require("webvtt-parser");
const fs = require("fs");
const { isChinese } = require("mandarino");

const parser = new WebVTTParser();

const getTrack = ({ tracks, lang }) => {
  const track = tracks.find((t) => t.languageCode === lang);

  if (track) {
    return track;
  }

  if (tracks?.length === 1) {
    return tracks[0];
  }
};

const resolveTrack = ({ tracks, lang }) => {
  let zhTrack;
  try {
    zhTrack = getTrack({ lang: "zh-CN", tracks });
  } catch (err) {
    zhTrack = null;
  }

  if (!zhTrack) {
    try {
      zhTrack = getTrack({ lang: "zh", tracks });
    } catch (err) {
      zhTrack = null;
    }
  }
  if (!zhTrack) {
    try {
      zhTrack = getTrack({ lang: "zh-Hant", tracks });
    } catch (err) {
      zhTrack = null;
    }
  }
  if (!zhTrack) {
    try {
      zhTrack = getTrack({ lang, tracks });
    } catch (err) {
      zhTrack = null;
    }
  }

  if (!zhTrack) {
    zhTrack = tracks[0];
  }

  return zhTrack;
};

const listSubtitles = async ({ id, lang }) => {
  const info = await ytdl.getInfo(id);

  const { videoDetails, related_videos } = info;
  const { title, description, author, thumbnails } = info.videoDetails;

  const tracks =
    info.player_response.captions.playerCaptionsTracklistRenderer.captionTracks;

  if (tracks && tracks.length) {
    console.log(
      "Found captions for",
      tracks.map((t) => t?.name?.simpleText).join(", ")
    );

    const langCodes = tracks.map((track) => track.languageCode);

    let resolvedLang = langCodes?.[0] || lang;

    const zhTrack = resolveTrack({ lang: resolvedLang, tracks });

    let subtitles;

    try {
      subtitles = zhTrack
        ? await httpRequest(`${zhTrack?.baseUrl}&fmt=vtt`)
        : null;
    } catch (err) {
      subtitles = null;
    }

    const tree = parser.parse(subtitles, "metadata");

    const newSubtitles = tree?.cues
      ?.map((cue) => {
        const hanziProps =
          resolvedLang === "zh-CN"
            ? {
                input: cue?.text?.split("\n").join(" "),
                pinyin: "",
              }
            : {
                input: cue?.text?.split("\n").join(" "),
              };

        return {
          lang: "zh",
          start: cue?.startTime,
          end: cue?.endTime,
          isChinese: isChinese(hanziProps.input),
          ...hanziProps,
        };
      })
      .reduce((acc, curr, idx, ctx) => {
        const items = ctx.filter((item) => item?.start === curr?.start);
        const hanzi = items?.find((item) => item.isChinese);
        const en = items?.find((item) => !item.isChinese);

        // hanzi ? delete hanzi.isChinese : null;
        return acc.concat({
          lang: "zh",
          input: hanzi?.input,
          start: hanzi?.start,
          end: hanzi?.end,
          en: en?.input,
        });
      }, []);

    return {
      title,
      description,
      subtitles: newSubtitles,
      thumbnails,
      author,
    };
  } else {
    console.log("No captions found for this video");
  }

  return ytdl.getInfo(id).then(async (info) => {
    // const tracks =
    //   info.player_response.captions.playerCaptionsTracklistRenderer
    //     .captionTracks;

    // const { videoDetails } = info;
    const { videoDetails, related_videos } = info;
    const tracks =
      info.player_response.captions.playerCaptionsTracklistRenderer
        .captionTracks;
    if (tracks && tracks.length) {
      console.log(
        "Found captions for",
        tracks.map((t) => t?.name?.simpleText).join(", ")
      );

      const langCodes = tracks.map((track) => track.languageCode);

      let resolvedLang = langCodes?.[0] || lang;

      const zhTrack = resolveTrack({ lang: resolvedLang, tracks });

      let subtitles;

      try {
        subtitles = zhTrack
          ? await httpRequest(`${zhTrack?.baseUrl}&fmt=vtt`)
          : null;
      } catch (err) {
        subtitles = null;
      }

      const tree = parser.parse(subtitles, "metadata");

      const newSubtitles = tree?.cues?.map((cue) => {
        const hanziProps =
          resolvedLang === "zh-CN"
            ? {
                input: cue?.text?.split("\n").join(" "),
                pinyin: "",
              }
            : {
                input: cue?.text?.split("\n").join(" "),
              };

        return {
          lang: "zh",
          start: cue?.startTime,
          end: cue?.endTime,
          ...hanziProps,
        };
      });

      return newSubtitles;

      return {
        subtitles: newSubtitles,
        videoDetails,
        tracks,
        relatedVideos: related_videos,
      };
    } else {
      console.log("No captions found for this video");
    }
  });
};

const id = "https://www.youtube.com/watch?v=kaAK9mKO8cs";
const lang = "zh-CN";

listSubtitles({ id, lang }).then((transcriptions) => {
  fs.writeFileSync(`./${Date.now()}.json`, JSON.stringify(transcriptions));
  console.log(transcriptions);
});
