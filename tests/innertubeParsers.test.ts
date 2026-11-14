import { describe, expect, it } from 'vitest';
import {
  classifySearchCategory,
  extractSearchRenderers,
  extractTracksFromBrowseShelf,
  parseBrowseDetails,
} from '../src/shared/innertubeParsers';

describe('innertubeParsers (Search & Browse Details)', () => {
  it('classifies Artists, Albums, Playlists, Videos, and Songs accurately', () => {
    expect(
      classifySearchCategory({
        pageType: 'MUSIC_PAGE_TYPE_ARTIST',
        browseId: 'UC12345',
        subtitleText: 'Artist • 12M monthly audience',
        hasVideoId: true,
      })
    ).toBe('Artist');

    expect(
      classifySearchCategory({
        pageType: 'MUSIC_PAGE_TYPE_ALBUM',
        browseId: 'MPREb_abc',
        subtitleText: 'Album • Tory Lanez • 2021',
        hasVideoId: false,
      })
    ).toBe('Album');

    expect(
      classifySearchCategory({
        pageType: 'MUSIC_PAGE_TYPE_PLAYLIST',
        browseId: 'VLPL999',
        subtitleText: 'Playlist • Night Vibes',
        hasVideoId: false,
      })
    ).toBe('Playlist');

    expect(
      classifySearchCategory({
        mvType: 'MUSIC_VIDEO_TYPE_OMV',
        subtitleText: 'Video • Tory Lanez • 3:45',
        hasVideoId: true,
      })
    ).toBe('Video');

    // A playable Song whose album/title contains "Single" or "EP" should remain a Song
    expect(
      classifySearchCategory({
        mvType: 'MUSIC_VIDEO_TYPE_ATV',
        subtitleText: 'Artist • Summer EP • 2:55',
        hasVideoId: true,
      })
    ).toBe('Song');
  });

  it('extracts Top Results hero card, nested items, and Artists shelves cleanly', () => {
    const mockSearchPayload = {
      contents: {
        tabbedSearchResultsRenderer: {
          tabs: [
            {
              tabRenderer: {
                content: {
                  sectionListRenderer: {
                    contents: [
                      {
                        musicCardShelfRenderer: {
                          header: {
                            musicCardShelfHeaderBasicRenderer: {
                              title: { runs: [{ text: 'Top result' }] },
                            },
                          },
                          title: {
                            runs: [
                              {
                                text: 'Tory Lanez',
                                navigationEndpoint: {
                                  browseEndpoint: {
                                    browseId: 'UCtory123',
                                    browseEndpointContextSupportedConfigs: {
                                      browseEndpointContextMusicConfig: {
                                        pageType: 'MUSIC_PAGE_TYPE_ARTIST',
                                      },
                                    },
                                  },
                                },
                              },
                            ],
                          },
                          subtitle: {
                            runs: [{ text: 'Artist • 14M monthly audience' }],
                          },
                          thumbnail: {
                            musicThumbnailRenderer: {
                              thumbnail: {
                                thumbnails: [
                                  {
                                    url: 'https://lh3.googleusercontent.com/art=w120-h120-l90-rj',
                                  },
                                ],
                              },
                            },
                          },
                          buttons: [
                            {
                              buttonRenderer: {
                                command: {
                                  watchEndpoint: {
                                    videoId: 'vidRadio1',
                                    playlistId: 'RDEM123',
                                  },
                                },
                              },
                            },
                          ],
                          contents: [
                            {
                              musicResponsiveListItemRenderer: {
                                flexColumns: [
                                  {
                                    musicResponsiveListItemFlexColumnRenderer: {
                                      text: {
                                        runs: [
                                          {
                                            text: 'Lavender Sunflower',
                                            navigationEndpoint: {
                                              watchEndpoint: {
                                                videoId: 'vidLav',
                                                playlistId: 'RDAMVMvidLav',
                                              },
                                            },
                                          },
                                        ],
                                      },
                                    },
                                  },
                                  {
                                    musicResponsiveListItemFlexColumnRenderer: {
                                      text: {
                                        runs: [{ text: 'Song • Tory Lanez • 2:32' }],
                                      },
                                    },
                                  },
                                ],
                                menu: {
                                  menuRenderer: {
                                    items: [
                                      {
                                        menuServiceItemRenderer: {
                                          serviceEndpoint: {
                                            queueAddEndpoint: {
                                              queueInsertPosition: 'INSERT_AT_END',
                                              queueTarget: { videoId: 'vidLav' },
                                            },
                                          },
                                        },
                                      },
                                    ],
                                  },
                                },
                              },
                            },
                          ],
                        },
                      },
                      {
                        musicShelfRenderer: {
                          title: { runs: [{ text: 'Artists' }] },
                          contents: [
                            {
                              musicResponsiveListItemRenderer: {
                                flexColumns: [
                                  {
                                    musicResponsiveListItemFlexColumnRenderer: {
                                      text: {
                                        runs: [{ text: 'Bryson Tiller' }],
                                      },
                                    },
                                  },
                                ],
                                navigationEndpoint: {
                                  browseEndpoint: {
                                    browseId: 'UCbryson',
                                    browseEndpointContextSupportedConfigs: {
                                      browseEndpointContextMusicConfig: {
                                        pageType: 'MUSIC_PAGE_TYPE_ARTIST',
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    };

    const items = extractSearchRenderers(mockSearchPayload);
    expect(items).toHaveLength(3);

    expect(items[0].title).toBe('Tory Lanez');
    expect(items[0].category).toBe('Artist');
    expect(items[0].browseId).toBe('UCtory123');
    expect(items[0].isTopResult).toBe(true);
    expect(items[0].artworkUrl).toBe(
      'https://lh3.googleusercontent.com/art=w1000-h1000-l90-rj'
    );

    expect(items[1].title).toBe('Lavender Sunflower');
    expect(items[1].category).toBe('Song');
    expect(items[1].isTopResult).toBe(true);
    expect(items[1].videoId).toBe('vidLav');
    expect(items[1].addToQueueEndpoint).toBeTruthy();

    expect(items[2].title).toBe('Bryson Tiller');
    expect(items[2].category).toBe('Artist');
    expect(items[2].browseId).toBe('UCbryson');
    expect(items[2].isTopResult).toBe(false);
  });

  it('parses Artist Details including bio, Play/Shuffle, Top Songs & Show All endpoint', () => {
    const mockArtistBrowse = {
      header: {
        musicImmersiveHeaderRenderer: {
          title: { runs: [{ text: 'Tory Lanez' }] },
          description: { runs: [{ text: 'Canadian rapper and singer.' }] },
          thumbnail: {
            musicThumbnailRenderer: {
              thumbnail: {
                thumbnails: [
                  { url: 'https://lh3.googleusercontent.com/tory=w226-h226-l90-rj' },
                ],
              },
            },
          },
          playButton: {
            buttonRenderer: {
              icon: { iconType: 'PLAY_ARROW' },
              navigationEndpoint: {
                watchPlaylistEndpoint: { playlistId: 'RDEMtory' },
              },
            },
          },
          startRadioButton: {
            buttonRenderer: {
              navigationEndpoint: {
                watchPlaylistEndpoint: { playlistId: 'RDEMradio' },
              },
            },
          },
        },
      },
      contents: {
        singleColumnBrowseResultsRenderer: {
          tabs: [
            {
              tabRenderer: {
                content: {
                  sectionListRenderer: {
                    contents: [
                      {
                        musicShelfRenderer: {
                          title: { runs: [{ text: 'Songs' }] },
                          bottomEndpoint: {
                            browseEndpoint: {
                              browseId: 'VLOLAK_all_songs',
                              params: 'ggM=',
                            },
                          },
                          contents: [
                            {
                              musicResponsiveListItemRenderer: {
                                flexColumns: [
                                  {
                                    musicResponsiveListItemFlexColumnRenderer: {
                                      text: {
                                        runs: [
                                          {
                                            text: 'The Color Violet',
                                            navigationEndpoint: {
                                              watchEndpoint: { videoId: 'vidCV' },
                                            },
                                          },
                                        ],
                                      },
                                    },
                                  },
                                  {
                                    musicResponsiveListItemFlexColumnRenderer: {
                                      text: {
                                        runs: [{ text: 'Tory Lanez' }],
                                      },
                                    },
                                  },
                                  {
                                    musicResponsiveListItemFlexColumnRenderer: {
                                      text: {
                                        runs: [
                                          {
                                            text: 'Alone at Prom',
                                            navigationEndpoint: {
                                              browseEndpoint: {
                                                browseId: 'MPREb_prom',
                                                browseEndpointContextSupportedConfigs: {
                                                  browseEndpointContextMusicConfig: {
                                                    pageType: 'MUSIC_PAGE_TYPE_ALBUM',
                                                  },
                                                },
                                              },
                                            },
                                          },
                                        ],
                                      },
                                    },
                                  },
                                ],
                                fixedColumns: [
                                  {
                                    musicResponsiveListItemFixedColumnRenderer: {
                                      text: { runs: [{ text: '3:47' }] },
                                    },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    };

    const parsed = parseBrowseDetails(mockArtistBrowse, 'UCtory123', 'Artist');
    expect(parsed).not.toBeNull();
    expect(parsed!.details.kind).toBe('Artist');
    expect(parsed!.details.title).toBe('Tory Lanez');
    expect(parsed!.details.description).toBe('Canadian rapper and singer.');
    expect(parsed!.details.tracksHeading).toBe('Top Songs');
    expect(parsed!.details.tracks).toHaveLength(1);
    expect(parsed!.details.tracks[0]).toMatchObject({
      title: 'The Color Violet',
      album: 'Alone at Prom',
      duration: '3:47',
      videoId: 'vidCV',
    });
    expect(parsed!.moreTracksBrowseEndpoint).toEqual({
      browseId: 'VLOLAK_all_songs',
      params: 'ggM=',
    });
  });

  it('parses two-column Album Details inheriting header artwork onto tracks', () => {
    const mockAlbumBrowse = {
      contents: {
        twoColumnBrowseResultsRenderer: {
          tabs: [
            {
              tabRenderer: {
                content: {
                  sectionListRenderer: {
                    contents: [
                      {
                        musicResponsiveHeaderRenderer: {
                          title: { runs: [{ text: 'Alone at Prom' }] },
                          subtitle: { runs: [{ text: 'Album • 2021' }] },
                          straplineTextOne: { runs: [{ text: 'Tory Lanez' }] },
                          thumbnail: {
                            musicThumbnailRenderer: {
                              thumbnail: {
                                thumbnails: [
                                  {
                                    url: 'https://lh3.googleusercontent.com/prom=w544-h544-l90-rj',
                                  },
                                ],
                              },
                            },
                          },
                          buttons: [
                            {
                              musicPlayButtonRenderer: {
                                playNavigationEndpoint: {
                                  watchPlaylistEndpoint: { playlistId: 'OLAK_prom' },
                                },
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
          secondaryContents: {
            sectionListRenderer: {
              contents: [
                {
                  musicShelfRenderer: {
                    contents: [
                      {
                        musicResponsiveListItemRenderer: {
                          flexColumns: [
                            {
                              musicResponsiveListItemFlexColumnRenderer: {
                                text: {
                                  runs: [
                                    {
                                      text: 'Enchanted Waterfall',
                                      navigationEndpoint: {
                                        watchEndpoint: { videoId: 'vidEW' },
                                      },
                                    },
                                  ],
                                },
                              },
                            },
                          ],
                          fixedColumns: [
                            {
                              musicResponsiveListItemFixedColumnRenderer: {
                                text: { runs: [{ text: '3:11' }] },
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        },
      },
    };

    const parsed = parseBrowseDetails(mockAlbumBrowse, 'MPREb_prom', 'Album');
    expect(parsed).not.toBeNull();
    expect(parsed!.details.kind).toBe('Album');
    expect(parsed!.details.title).toBe('Alone at Prom');
    expect(parsed!.details.playlistId).toBe('OLAK_prom');
    expect(parsed!.details.tracks).toHaveLength(1);
    expect(parsed!.details.tracks[0].artworkUrl).toBe(
      'https://lh3.googleusercontent.com/prom=w1000-h1000-l90-rj'
    );
    expect(parsed!.details.tracks[0].duration).toBe('3:11');

    const dedupedShelfTracks = extractTracksFromBrowseShelf(
      mockAlbumBrowse,
      'https://fallback.img',
      'OLAK_prom',
      'Tory Lanez'
    );
    expect(dedupedShelfTracks).toHaveLength(1);
    expect(dedupedShelfTracks[0].videoId).toBe('vidEW');
  });

  it('parses Playlist Details with musicPlaylistShelfRenderer, creator subtitle, and Shuffle menu endpoint', () => {
    const mockPlaylistBrowse = {
      header: {
        musicDetailHeaderRenderer: {
          title: { runs: [{ text: 'Late Night Drive' }] },
          subtitle: { runs: [{ text: 'Playlist • Curated by Jerome • 2026' }] },
          secondSubtitle: { runs: [{ text: '24 songs • 1 hr 20 min' }] },
          thumbnail: {
            musicThumbnailRenderer: {
              thumbnail: {
                thumbnails: [{ url: 'https://i.ytimg.com/vi/abc/hqdefault.jpg' }],
              },
            },
          },
          menu: {
            menuRenderer: {
              items: [
                {
                  menuNavigationItemRenderer: {
                    icon: { iconType: 'SHUFFLE' },
                    text: { runs: [{ text: 'Shuffle play' }] },
                    navigationEndpoint: {
                      watchPlaylistEndpoint: {
                        playlistId: 'PLdrive123',
                        params: 'wAEB8gECKAE%3D',
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      },
      contents: {
        singleColumnBrowseResultsRenderer: {
          tabs: [
            {
              tabRenderer: {
                content: {
                  sectionListRenderer: {
                    contents: [
                      {
                        musicPlaylistShelfRenderer: {
                          contents: [
                            {
                              musicResponsiveListItemRenderer: {
                                flexColumns: [
                                  {
                                    musicResponsiveListItemFlexColumnRenderer: {
                                      text: {
                                        runs: [
                                          {
                                            text: 'Midnight City',
                                            navigationEndpoint: {
                                              watchEndpoint: {
                                                videoId: 'vidMC',
                                                playlistId: 'PLdrive123',
                                              },
                                            },
                                          },
                                        ],
                                      },
                                    },
                                  },
                                  {
                                    musicResponsiveListItemFlexColumnRenderer: {
                                      text: { runs: [{ text: 'M83' }] },
                                    },
                                  },
                                  {
                                    musicResponsiveListItemFlexColumnRenderer: {
                                      text: { runs: [{ text: '4:03' }] },
                                    },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    };

    const parsed = parseBrowseDetails(mockPlaylistBrowse, 'VLPLdrive123');
    expect(parsed).not.toBeNull();
    expect(parsed!.details.kind).toBe('Playlist');
    expect(parsed!.details.title).toBe('Late Night Drive');
    expect(parsed!.details.subtitle).toContain('Curated by Jerome');
    expect(parsed!.details.tracksHeading).toBe('Playlist Tracks');
    expect(parsed!.details.playlistId).toBe('PLdrive123');
    expect(parsed!.details.shuffleEndpoint).toEqual({
      watchPlaylistEndpoint: {
        playlistId: 'PLdrive123',
        params: 'wAEB8gECKAE%3D',
      },
    });
    expect(parsed!.details.tracks).toHaveLength(1);
    expect(parsed!.details.tracks[0]).toMatchObject({
      title: 'Midnight City',
      duration: '4:03',
      videoId: 'vidMC',
      playlistId: 'PLdrive123',
    });
    expect(parsed!.details.tracks[0].artworkUrl).toBe(
      'https://i.ytimg.com/vi/abc/hq720.jpg'
    );
  });
});
