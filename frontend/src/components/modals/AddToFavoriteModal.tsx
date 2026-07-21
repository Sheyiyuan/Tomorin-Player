import React, { useEffect, useState } from "react";
import { Button, Stack, Text } from "@mantine/core";
import { Favorite, Song, type DerivedStyles } from "../../types";
import * as Services from "../../../wailsjs/go/services/Service";
import ThemedModal from "./ThemedModal";

export type AddToFavoriteModalProps = {
    opened: boolean;
    onClose: () => void;
    favorites: Favorite[];
    currentSong: Song | null;
    pendingFavoriteSong?: Song | null;
    themeColor: string;
    onAdd: (fav: Favorite) => void;
    derived?: DerivedStyles;
};

const AddToFavoriteModal: React.FC<AddToFavoriteModalProps> = ({ opened, onClose, favorites, currentSong, pendingFavoriteSong, themeColor, onAdd, derived }) => {
    // 优先使用 pendingFavoriteSong，如果没有则使用 currentSong
    const targetSong = pendingFavoriteSong || currentSong;
	const [memberships, setMemberships] = useState<Set<string>>(new Set());
	const [membershipLoading, setMembershipLoading] = useState(false);
	useEffect(() => {
		let active = true;
		if (!opened || !targetSong?.id) {
			setMemberships(new Set());
			return () => { active = false; };
		}
		setMembershipLoading(true);
		void Promise.resolve().then(() => Services.GetFavoriteMemberships(targetSong.id))
			.then((ids) => { if (active) setMemberships(new Set(ids)); })
			.catch(() => { if (active) setMemberships(new Set()); })
			.finally(() => { if (active) setMembershipLoading(false); });
		return () => { active = false; };
	}, [opened, targetSong?.id]);
    return (
        <ThemedModal
            derived={derived}
            opened={opened}
            onClose={onClose}
            title="添加到歌单"
            centered
            overlayProps={{ blur: 10, opacity: 0.35 }}
        >
            <Stack gap="md">
                {favorites.length === 0 ? (
                    <Text c={derived?.textColorSecondary}>没有歌单</Text>
                ) : (
                    favorites.map((fav) => {
						const isInFav = memberships.has(fav.id);
						const isLocked = fav.source?.locked === true;
                        return (
                            <Button
                                key={fav.id}
                                variant={isInFav ? "light" : "default"}
                                color={themeColor}
								disabled={membershipLoading || isInFav || isLocked}
                                onClick={() => {
									if (targetSong && !isInFav && !isLocked) {
                                        onAdd(fav);
                                    }
                                }}
                                styles={{
                                    root: {
									backgroundColor: !isInFav && !isLocked ? derived?.controlBackground : undefined,
									color: !isInFav && !isLocked ? derived?.textColorPrimary : undefined,
                                    }
                                }}
                            >
								{fav.title} {isInFav ? "（已添加）" : isLocked ? "（同步歌单）" : ""}
                            </Button>
                        );
                    })
                )}
            </Stack>
        </ThemedModal>
    );
};

export default AddToFavoriteModal;
