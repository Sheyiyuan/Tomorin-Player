import { useEffect, useMemo, useRef, useState } from 'react';
import * as Services from '../../../wailsjs/go/services/Service';
import { models } from '../../../wailsjs/go/models';
import { convertLocalSongSearchPage, type Favorite, type Song } from '../../types';

export type GlobalSearchResult =
	| { kind: 'song'; song: Song }
	| { kind: 'favorite'; favorite: Favorite };

interface UseGlobalSearchProps {
	globalSearchTerm: string;
	favorites: Favorite[];
}

const normalizeText = (value?: string | null): string => (value || '').toLowerCase();

export const useGlobalSearch = ({ globalSearchTerm, favorites }: UseGlobalSearchProps) => {
	const [songResults, setSongResults] = useState<Song[]>([]);
	const [loading, setLoading] = useState(false);
	const generationRef = useRef(0);

	useEffect(() => {
		const term = globalSearchTerm.trim();
		const generation = ++generationRef.current;
		if (!term) {
			setSongResults([]);
			setLoading(false);
			return;
		}
		const timer = window.setTimeout(() => {
			setLoading(true);
			void Services.SearchLocalSongPage(new models.LocalSongSearchRequest({ query: term, offset: 0, limit: 50 }))
				.then((page) => {
					if (generationRef.current !== generation) return;
					setSongResults(convertLocalSongSearchPage(page).items);
				})
				.catch(() => {
					if (generationRef.current === generation) setSongResults([]);
				})
				.finally(() => {
					if (generationRef.current === generation) setLoading(false);
				});
		}, 200);
		return () => window.clearTimeout(timer);
	}, [globalSearchTerm]);

	const globalSearchResults = useMemo<GlobalSearchResult[]>(() => {
		const term = globalSearchTerm.trim().toLowerCase();
		if (!term) return [];
		const favoriteResults: GlobalSearchResult[] = favorites
			.filter((favorite) => normalizeText(favorite.id).includes(term) || normalizeText(favorite.title).includes(term))
			.map((favorite) => ({ kind: 'favorite', favorite }));
		return [
			...songResults.map((song): GlobalSearchResult => ({ kind: 'song', song })),
			...favoriteResults,
		];
	}, [favorites, globalSearchTerm, songResults]);

	return { globalSearchResults, loading };
};
