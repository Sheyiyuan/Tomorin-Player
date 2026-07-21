export namespace models {

	export class BiliAudio {
	    url: string;
	    expiresAt: time.Time;
	    fromCache: boolean;
	    title: string;
	    format: string;
	    cover: string;
	    duration: number;
	    author: string;

	    static createFrom(source: any = {}) {
	        return new BiliAudio(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.url = source["url"];
	        this.expiresAt = this.convertValues(source["expiresAt"], time.Time);
	        this.fromCache = source["fromCache"];
	        this.title = source["title"];
	        this.format = source["format"];
	        this.cover = source["cover"];
	        this.duration = source["duration"];
	        this.author = source["author"];
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class BiliFavoriteCollection {
	    id: number;
	    title: string;
	    count: number;
	    cover: string;

	    static createFrom(source: any = {}) {
	        return new BiliFavoriteCollection(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.count = source["count"];
	        this.cover = source["cover"];
	    }
	}
	export class BiliFavoriteImportRequest {
	    remoteId: number;
	    name: string;
	    locked: boolean;

	    static createFrom(source: any = {}) {
	        return new BiliFavoriteImportRequest(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.remoteId = source["remoteId"];
	        this.name = source["name"];
	        this.locked = source["locked"];
	    }
	}
	export class PlaylistSyncRun {
	    id: string;
	    sourceId: string;
	    status: string;
	    snapshotComplete: boolean;
	    remoteCount: number;
	    resolvedCount: number;
	    addedCount: number;
	    removedCount: number;
	    skippedCount: number;
	    pendingCount: number;
	    errorCode: string;
	    errorMessage: string;
	    startedAt: time.Time;
	    finishedAt?: time.Time;

	    static createFrom(source: any = {}) {
	        return new PlaylistSyncRun(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.sourceId = source["sourceId"];
	        this.status = source["status"];
	        this.snapshotComplete = source["snapshotComplete"];
	        this.remoteCount = source["remoteCount"];
	        this.resolvedCount = source["resolvedCount"];
	        this.addedCount = source["addedCount"];
	        this.removedCount = source["removedCount"];
	        this.skippedCount = source["skippedCount"];
	        this.pendingCount = source["pendingCount"];
	        this.errorCode = source["errorCode"];
	        this.errorMessage = source["errorMessage"];
	        this.startedAt = this.convertValues(source["startedAt"], time.Time);
	        this.finishedAt = this.convertValues(source["finishedAt"], time.Time);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PlaylistSyncStatus {
	    source?: PlaylistSource;
	    run?: PlaylistSyncRun;

	    static createFrom(source: any = {}) {
	        return new PlaylistSyncStatus(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.source = this.convertValues(source["source"], PlaylistSource);
	        this.run = this.convertValues(source["run"], PlaylistSyncRun);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PlaylistSource {
	    id: string;
	    favoriteId: string;
	    provider: string;
	    remoteId: string;
	    remoteOwnerId: string;
	    remoteTitle: string;
	    locked: boolean;
	    detachedAt?: time.Time;
	    syncState: string;
	    lastErrorCode: string;
	    lastErrorMessage: string;
	    lastSnapshotHash: string;
	    remoteCount: number;
	    lastSyncedAt?: time.Time;
	    lastAttemptedAt?: time.Time;
	    createdAt: time.Time;
	    updatedAt: time.Time;

	    static createFrom(source: any = {}) {
	        return new PlaylistSource(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.favoriteId = source["favoriteId"];
	        this.provider = source["provider"];
	        this.remoteId = source["remoteId"];
	        this.remoteOwnerId = source["remoteOwnerId"];
	        this.remoteTitle = source["remoteTitle"];
	        this.locked = source["locked"];
	        this.detachedAt = this.convertValues(source["detachedAt"], time.Time);
	        this.syncState = source["syncState"];
	        this.lastErrorCode = source["lastErrorCode"];
	        this.lastErrorMessage = source["lastErrorMessage"];
	        this.lastSnapshotHash = source["lastSnapshotHash"];
	        this.remoteCount = source["remoteCount"];
	        this.lastSyncedAt = this.convertValues(source["lastSyncedAt"], time.Time);
	        this.lastAttemptedAt = this.convertValues(source["lastAttemptedAt"], time.Time);
	        this.createdAt = this.convertValues(source["createdAt"], time.Time);
	        this.updatedAt = this.convertValues(source["updatedAt"], time.Time);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SongRef {
	    id: number;
	    favoriteId: string;
	    songId: string;
	    position: number;

	    static createFrom(source: any = {}) {
	        return new SongRef(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.favoriteId = source["favoriteId"];
	        this.songId = source["songId"];
	        this.position = source["position"];
	    }
	}
	export class Favorite {
	    id: string;
	    title: string;
	    songIds: SongRef[];
	    source?: PlaylistSource;
	    createdAt: time.Time;
	    updatedAt: time.Time;

	    static createFrom(source: any = {}) {
	        return new Favorite(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.songIds = this.convertValues(source["songIds"], SongRef);
	        this.source = this.convertValues(source["source"], PlaylistSource);
	        this.createdAt = this.convertValues(source["createdAt"], time.Time);
	        this.updatedAt = this.convertValues(source["updatedAt"], time.Time);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class BiliFavoriteImportResult {
	    favorite: Favorite;
	    syncStatus: PlaylistSyncStatus;

	    static createFrom(source: any = {}) {
	        return new BiliFavoriteImportResult(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.favorite = this.convertValues(source["favorite"], Favorite);
	        this.syncStatus = this.convertValues(source["syncStatus"], PlaylistSyncStatus);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PlaylistSyncProgress {
	    stage: string;
	    favoriteId?: string;
	    completedVideoCount: number;
	    totalVideoCount: number;
	    skippedCount: number;

	    static createFrom(source: any = {}) {
	        return new PlaylistSyncProgress(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.stage = source["stage"];
	        this.favoriteId = source["favoriteId"];
	        this.completedVideoCount = source["completedVideoCount"];
	        this.totalVideoCount = source["totalVideoCount"];
	        this.skippedCount = source["skippedCount"];
	    }
	}
	export class BiliFavoriteImportTask {
	    id: string;
	    status: string;
	    progress: PlaylistSyncProgress;
	    result?: BiliFavoriteImportResult;
	    errorCode: string;
	    errorMessage: string;
	    retryable: boolean;
	    errorDetails?: Record<string, string>;
	    startedAt: time.Time;
	    finishedAt?: time.Time;

	    static createFrom(source: any = {}) {
	        return new BiliFavoriteImportTask(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.status = source["status"];
	        this.progress = this.convertValues(source["progress"], PlaylistSyncProgress);
	        this.result = this.convertValues(source["result"], BiliFavoriteImportResult);
	        this.errorCode = source["errorCode"];
	        this.errorMessage = source["errorMessage"];
	        this.retryable = source["retryable"];
	        this.errorDetails = source["errorDetails"];
	        this.startedAt = this.convertValues(source["startedAt"], time.Time);
	        this.finishedAt = this.convertValues(source["finishedAt"], time.Time);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class BiliFavoriteInfo {
	    bvid: string;
	    title: string;
	    cover: string;

	    static createFrom(source: any = {}) {
	        return new BiliFavoriteInfo(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.bvid = source["bvid"];
	        this.title = source["title"];
	        this.cover = source["cover"];
	    }
	}

	export class Song {
	    id: string;
	    bvid: string;
	    name: string;
	    singer: string;
	    singerId: string;
	    cover: string;
	    coverLocal: string;
	    sourceId: string;
	    streamUrl: string;
	    streamUrlExpiresAt: time.Time;
	    lyric: string;
	    lyricOffset: number;
	    skipStartTime: number;
	    skipEndTime: number;
	    pageNumber: number;
	    pageTitle: string;
	    videoTitle: string;
	    totalPages: number;
	    duration: number;
	    createdAt: time.Time;
	    updatedAt: time.Time;

	    static createFrom(source: any = {}) {
	        return new Song(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.bvid = source["bvid"];
	        this.name = source["name"];
	        this.singer = source["singer"];
	        this.singerId = source["singerId"];
	        this.cover = source["cover"];
	        this.coverLocal = source["coverLocal"];
	        this.sourceId = source["sourceId"];
	        this.streamUrl = source["streamUrl"];
	        this.streamUrlExpiresAt = this.convertValues(source["streamUrlExpiresAt"], time.Time);
	        this.lyric = source["lyric"];
	        this.lyricOffset = source["lyricOffset"];
	        this.skipStartTime = source["skipStartTime"];
	        this.skipEndTime = source["skipEndTime"];
	        this.pageNumber = source["pageNumber"];
	        this.pageTitle = source["pageTitle"];
	        this.videoTitle = source["videoTitle"];
	        this.totalPages = source["totalPages"];
	        this.duration = source["duration"];
	        this.createdAt = this.convertValues(source["createdAt"], time.Time);
	        this.updatedAt = this.convertValues(source["updatedAt"], time.Time);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class FavoriteSongPage {
	    items: Song[];
	    total: number;
	    offset: number;
	    limit: number;
	    revision: string;

	    static createFrom(source: any = {}) {
	        return new FavoriteSongPage(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.items = this.convertValues(source["items"], Song);
	        this.total = source["total"];
	        this.offset = source["offset"];
	        this.limit = source["limit"];
	        this.revision = source["revision"];
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class FavoriteSongPageRequest {
	    favoriteId: string;
	    query: string;
	    offset: number;
	    limit: number;

	    static createFrom(source: any = {}) {
	        return new FavoriteSongPageRequest(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.favoriteId = source["favoriteId"];
	        this.query = source["query"];
	        this.offset = source["offset"];
	        this.limit = source["limit"];
	    }
	}
	export class FavoriteSummary {
	    id: string;
	    title: string;
	    songCount: number;
	    source?: PlaylistSource;
	    createdAt: time.Time;
	    updatedAt: time.Time;

	    static createFrom(source: any = {}) {
	        return new FavoriteSummary(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.songCount = source["songCount"];
	        this.source = this.convertValues(source["source"], PlaylistSource);
	        this.createdAt = this.convertValues(source["createdAt"], time.Time);
	        this.updatedAt = this.convertValues(source["updatedAt"], time.Time);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class FavoriteSyncTask {
	    id: string;
	    favoriteIds: string[];
	    status: string;
	    completedFavorites: number;
	    totalFavorites: number;
	    progress: PlaylistSyncProgress;
	    result?: PlaylistSyncStatus;
	    errorCode: string;
	    errorMessage: string;
	    retryable: boolean;
	    errorDetails?: Record<string, string>;
	    startedAt: time.Time;
	    finishedAt?: time.Time;

	    static createFrom(source: any = {}) {
	        return new FavoriteSyncTask(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.favoriteIds = source["favoriteIds"];
	        this.status = source["status"];
	        this.completedFavorites = source["completedFavorites"];
	        this.totalFavorites = source["totalFavorites"];
	        this.progress = this.convertValues(source["progress"], PlaylistSyncProgress);
	        this.result = this.convertValues(source["result"], PlaylistSyncStatus);
	        this.errorCode = source["errorCode"];
	        this.errorMessage = source["errorMessage"];
	        this.retryable = source["retryable"];
	        this.errorDetails = source["errorDetails"];
	        this.startedAt = this.convertValues(source["startedAt"], time.Time);
	        this.finishedAt = this.convertValues(source["finishedAt"], time.Time);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class LocalSongSearchPage {
	    items: Song[];
	    total: number;
	    offset: number;
	    limit: number;

	    static createFrom(source: any = {}) {
	        return new LocalSongSearchPage(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.items = this.convertValues(source["items"], Song);
	        this.total = source["total"];
	        this.offset = source["offset"];
	        this.limit = source["limit"];
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class LocalSongSearchRequest {
	    query: string;
	    offset: number;
	    limit: number;

	    static createFrom(source: any = {}) {
	        return new LocalSongSearchRequest(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.query = source["query"];
	        this.offset = source["offset"];
	        this.limit = source["limit"];
	    }
	}
	export class LyricLine {
	    startMs: number;
	    text: string;

	    static createFrom(source: any = {}) {
	        return new LyricLine(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.startMs = source["startMs"];
	        this.text = source["text"];
	    }
	}
	export class LyricDocument {
	    id: string;
	    songId: string;
	    source: string;
	    sourceLabel: string;
	    format: string;
	    rawText: string;
	    lines: LyricLine[];
	    metadata: Record<string, string>;
	    contentHash: string;
	    providerRef: string;
	    sourceUrl: string;
	    evidence: Record<string, string>;
	    encoding: string;
	    confidence: number;
	    embeddedOffsetMs: number;
	    isManual: boolean;
	    isReliable: boolean;
	    rejectedAt?: time.Time;
	    retrievedAt: time.Time;
	    createdAt: time.Time;
	    updatedAt: time.Time;

	    static createFrom(source: any = {}) {
	        return new LyricDocument(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.songId = source["songId"];
	        this.source = source["source"];
	        this.sourceLabel = source["sourceLabel"];
	        this.format = source["format"];
	        this.rawText = source["rawText"];
	        this.lines = this.convertValues(source["lines"], LyricLine);
	        this.metadata = source["metadata"];
	        this.contentHash = source["contentHash"];
	        this.providerRef = source["providerRef"];
	        this.sourceUrl = source["sourceUrl"];
	        this.evidence = source["evidence"];
	        this.encoding = source["encoding"];
	        this.confidence = source["confidence"];
	        this.embeddedOffsetMs = source["embeddedOffsetMs"];
	        this.isManual = source["isManual"];
	        this.isReliable = source["isReliable"];
	        this.rejectedAt = this.convertValues(source["rejectedAt"], time.Time);
	        this.retrievedAt = this.convertValues(source["retrievedAt"], time.Time);
	        this.createdAt = this.convertValues(source["createdAt"], time.Time);
	        this.updatedAt = this.convertValues(source["updatedAt"], time.Time);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class LyricImportPreview {
	    text: string;
	    format: string;
	    encoding: string;
	    lines: LyricLine[];
	    metadata: Record<string, string>;
	    embeddedOffsetMs: number;
	    validLineCount: number;
	    firstMs: number;
	    lastMs: number;
	    warnings: string[];

	    static createFrom(source: any = {}) {
	        return new LyricImportPreview(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.text = source["text"];
	        this.format = source["format"];
	        this.encoding = source["encoding"];
	        this.lines = this.convertValues(source["lines"], LyricLine);
	        this.metadata = source["metadata"];
	        this.embeddedOffsetMs = source["embeddedOffsetMs"];
	        this.validLineCount = source["validLineCount"];
	        this.firstMs = source["firstMs"];
	        this.lastMs = source["lastMs"];
	        this.warnings = source["warnings"];
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

	export class LyricMapping {
	    id: string;
	    lyric: string;
	    offsetMs: number;
	    updatedAt: time.Time;

	    static createFrom(source: any = {}) {
	        return new LyricMapping(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.lyric = source["lyric"];
	        this.offsetMs = source["offsetMs"];
	        this.updatedAt = this.convertValues(source["updatedAt"], time.Time);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class LyricPreference {
	    songId: string;
	    activeDocumentId: string;
	    offsetMs: number;
	    manualLocked: boolean;
	    updatedAt: time.Time;

	    static createFrom(source: any = {}) {
	        return new LyricPreference(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.songId = source["songId"];
	        this.activeDocumentId = source["activeDocumentId"];
	        this.offsetMs = source["offsetMs"];
	        this.manualLocked = source["manualLocked"];
	        this.updatedAt = this.convertValues(source["updatedAt"], time.Time);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class LyricSearchRequest {
	    songId: string;
	    requestId: string;
	    force: boolean;

	    static createFrom(source: any = {}) {
	        return new LyricSearchRequest(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.songId = source["songId"];
	        this.requestId = source["requestId"];
	        this.force = source["force"];
	    }
	}
	export class LyricView {
	    songId: string;
	    document?: LyricDocument;
	    candidates: LyricDocument[];
	    offsetMs: number;
	    manualLocked: boolean;

	    static createFrom(source: any = {}) {
	        return new LyricView(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.songId = source["songId"];
	        this.document = this.convertValues(source["document"], LyricDocument);
	        this.candidates = this.convertValues(source["candidates"], LyricDocument);
	        this.offsetMs = source["offsetMs"];
	        this.manualLocked = source["manualLocked"];
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class LyricSearchResult {
	    songId: string;
	    requestId: string;
	    view: LyricView;
	    autoApplied: boolean;
	    message: string;

	    static createFrom(source: any = {}) {
	        return new LyricSearchResult(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.songId = source["songId"];
	        this.requestId = source["requestId"];
	        this.view = this.convertValues(source["view"], LyricView);
	        this.autoApplied = source["autoApplied"];
	        this.message = source["message"];
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class LyricSearchTask {
	    requestId: string;
	    songId: string;
	    status: string;
	    result?: LyricSearchResult;
	    errorCode: string;
	    errorMessage: string;
	    retryable: boolean;
	    errorDetails?: Record<string, string>;
	    startedAt: time.Time;
	    finishedAt?: time.Time;

	    static createFrom(source: any = {}) {
	        return new LyricSearchTask(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.requestId = source["requestId"];
	        this.songId = source["songId"];
	        this.status = source["status"];
	        this.result = this.convertValues(source["result"], LyricSearchResult);
	        this.errorCode = source["errorCode"];
	        this.errorMessage = source["errorMessage"];
	        this.retryable = source["retryable"];
	        this.errorDetails = source["errorDetails"];
	        this.startedAt = this.convertValues(source["startedAt"], time.Time);
	        this.finishedAt = this.convertValues(source["finishedAt"], time.Time);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

	export class PlayerSetting {
	    id: number;
	    config: Record<string, any>;
	    updatedAt: time.Time;

	    static createFrom(source: any = {}) {
	        return new PlayerSetting(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.config = source["config"];
	        this.updatedAt = this.convertValues(source["updatedAt"], time.Time);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Playlist {
	    id: number;
	    queue: string;
	    currentIndex: number;
	    updatedAt: time.Time;

	    static createFrom(source: any = {}) {
	        return new Playlist(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.queue = source["queue"];
	        this.currentIndex = source["currentIndex"];
	        this.updatedAt = this.convertValues(source["updatedAt"], time.Time);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

	export class PlaylistSourceItem {
	    id: string;
	    sourceId: string;
	    remoteKey: string;
	    bvid: string;
	    pageNumber: number;
	    songId: string;
	    position: number;
	    state: string;
	    lastSeenAt: time.Time;
	    createdAt: time.Time;
	    updatedAt: time.Time;

	    static createFrom(source: any = {}) {
	        return new PlaylistSourceItem(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.sourceId = source["sourceId"];
	        this.remoteKey = source["remoteKey"];
	        this.bvid = source["bvid"];
	        this.pageNumber = source["pageNumber"];
	        this.songId = source["songId"];
	        this.position = source["position"];
	        this.state = source["state"];
	        this.lastSeenAt = this.convertValues(source["lastSeenAt"], time.Time);
	        this.createdAt = this.convertValues(source["createdAt"], time.Time);
	        this.updatedAt = this.convertValues(source["updatedAt"], time.Time);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}





	export class Theme {
	    id: string;
	    name: string;
	    data: string;
	    isDefault: boolean;
	    isReadOnly: boolean;

	    static createFrom(source: any = {}) {
	        return new Theme(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.data = source["data"];
	        this.isDefault = source["isDefault"];
	        this.isReadOnly = source["isReadOnly"];
	    }
	}

}

export namespace services {

	export class ExportData {
	    songs: models.Song[];
	    favorites: models.Favorite[];
	    settings: models.PlayerSetting;
	    lyrics: models.LyricMapping[];
	    lyricDocuments: models.LyricDocument[];
	    lyricPreferences: models.LyricPreference[];
	    playlistSources: models.PlaylistSource[];
	    playlistSourceItems: models.PlaylistSourceItem[];
	    playlistSyncRuns: models.PlaylistSyncRun[];

	    static createFrom(source: any = {}) {
	        return new ExportData(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.songs = this.convertValues(source["songs"], models.Song);
	        this.favorites = this.convertValues(source["favorites"], models.Favorite);
	        this.settings = this.convertValues(source["settings"], models.PlayerSetting);
	        this.lyrics = this.convertValues(source["lyrics"], models.LyricMapping);
	        this.lyricDocuments = this.convertValues(source["lyricDocuments"], models.LyricDocument);
	        this.lyricPreferences = this.convertValues(source["lyricPreferences"], models.LyricPreference);
	        this.playlistSources = this.convertValues(source["playlistSources"], models.PlaylistSource);
	        this.playlistSourceItems = this.convertValues(source["playlistSourceItems"], models.PlaylistSourceItem);
	        this.playlistSyncRuns = this.convertValues(source["playlistSyncRuns"], models.PlaylistSyncRun);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class LoginPollResponse {
	    loggedIn: boolean;
	    message: string;

	    static createFrom(source: any = {}) {
	        return new LoginPollResponse(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.loggedIn = source["loggedIn"];
	        this.message = source["message"];
	    }
	}
	export class PlayHistory {
	    favoriteId: string;
	    songId: string;
	    timestamp: number;

	    static createFrom(source: any = {}) {
	        return new PlayHistory(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.favoriteId = source["favoriteId"];
	        this.songId = source["songId"];
	        this.timestamp = source["timestamp"];
	    }
	}
	export class PlayInfo {
	    RawURL: string;
	    ProxyURL: string;
	    ExpiresAt: time.Time;
	    Title: string;
	    Duration: number;

	    static createFrom(source: any = {}) {
	        return new PlayInfo(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.RawURL = source["RawURL"];
	        this.ProxyURL = source["ProxyURL"];
	        this.ExpiresAt = this.convertValues(source["ExpiresAt"], time.Time);
	        this.Title = source["Title"];
	        this.Duration = source["Duration"];
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class QRCodeResponse {
	    url: string;
	    qrcode_key: string;
	    expire_at: time.Time;

	    static createFrom(source: any = {}) {
	        return new QRCodeResponse(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.url = source["url"];
	        this.qrcode_key = source["qrcode_key"];
	        this.expire_at = this.convertValues(source["expire_at"], time.Time);
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class UserInfo {
	    uid: number;
	    username: string;
	    face: string;
	    level: number;
	    vip_type: number;

	    static createFrom(source: any = {}) {
	        return new UserInfo(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.uid = source["uid"];
	        this.username = source["username"];
	        this.face = source["face"];
	        this.level = source["level"];
	        this.vip_type = source["vip_type"];
	    }
	}

}

export namespace time {

	export class Time {


	    static createFrom(source: any = {}) {
	        return new Time(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);

	    }
	}

}

