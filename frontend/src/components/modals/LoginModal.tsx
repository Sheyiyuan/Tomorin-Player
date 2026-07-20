import React, { useCallback, useEffect, useRef, useState } from "react";
import { Group, Button, Text, Stack, Loader, Alert } from "@mantine/core";
import QRCode from "qrcode";
import * as Services from "../../../wailsjs/go/services/Service";
import type { DerivedStyles } from "../../types";
import ThemedModal from "./ThemedModal";

interface LoginModalProps {
    opened: boolean;
    onClose: () => void;
    onLoginSuccess: () => void;
    derived?: DerivedStyles;
}

export default function LoginModal({ opened, onClose, onLoginSuccess, derived }: LoginModalProps) {
    const [qrUrl, setQrUrl] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [isExpired, setIsExpired] = useState(false);
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const expiryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const generationRef = useRef(0);

    const stopPolling = useCallback(() => {
        if (pollIntervalRef.current !== null) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
        if (expiryTimeoutRef.current !== null) {
            clearTimeout(expiryTimeoutRef.current);
            expiryTimeoutRef.current = null;
        }
        if (successTimeoutRef.current !== null) {
            clearTimeout(successTimeoutRef.current);
            successTimeoutRef.current = null;
        }
    }, []);

    const startPolling = useCallback((key: string, generation: number) => {
        stopPolling();

        pollIntervalRef.current = setInterval(async () => {
            try {
                const result = await Services.PollLogin(key);
                if (generation !== generationRef.current) return;

                if (result.loggedIn) {
                    stopPolling();
                    successTimeoutRef.current = setTimeout(() => {
                        if (generation !== generationRef.current) return;
                        onLoginSuccess();
                        onClose();
                    }, 500);
                }
            } catch (error: unknown) {
                if (generation !== generationRef.current) return;
                console.error("轮询登录状态错误:", error);
                stopPolling();
                setErrorMessage("登录状态检查失败，请重新生成二维码");
            }
        }, 2000);

        expiryTimeoutRef.current = setTimeout(() => {
            if (generation !== generationRef.current) return;
            stopPolling();
            setIsExpired(true);
        }, 30000);
    }, [onClose, onLoginSuccess, stopPolling]);

    const generateQR = useCallback(async () => {
        stopPolling();
        const generation = generationRef.current + 1;
        generationRef.current = generation;
        try {
            setIsLoading(true);
            setErrorMessage("");
            setIsExpired(false);
            setQrUrl("");

            const result = await Services.GenerateLoginQR();
            if (generation !== generationRef.current) return;

            if (result.url && result.qrcode_key) {
                // 使用 qrcode 库在本地生成二维码图片
                const qrDataUrl = await QRCode.toDataURL(result.url, {
                    width: 256,
                    margin: 2,
                    color: {
                        dark: '#000000',
                        light: '#FFFFFF'
                    }
                });
                if (generation !== generationRef.current) return;

                setQrUrl(qrDataUrl);
                startPolling(result.qrcode_key, generation);
            } else {
                setErrorMessage("生成二维码失败，请稍后重试");
            }
        } catch (error: unknown) {
            if (generation !== generationRef.current) return;
            setErrorMessage(error instanceof Error ? error.message : "生成二维码失败");
            console.error("生成二维码错误:", error);
        } finally {
            if (generation === generationRef.current) setIsLoading(false);
        }
    }, [startPolling, stopPolling]);

    useEffect(() => {
        if (opened) {
            setQrUrl("");
            setErrorMessage("");
            setIsExpired(false);
            void generateQR();
            return;
        }

        generationRef.current += 1;
        stopPolling();
        setQrUrl("");
    }, [generateQR, opened, stopPolling]);

    useEffect(() => () => {
        generationRef.current += 1;
        stopPolling();
    }, [stopPolling]);

    return (
        <ThemedModal
            derived={derived}
            opened={opened}
            onClose={onClose}
            title="B站二维码登录"
            centered
            size="sm"
            closeOnEscape={true}
            closeOnClickOutside={true}
        >
            <Stack gap="md">
                {errorMessage && (
                    <Alert color="red" title="错误">
                        {errorMessage}
                    </Alert>
                )}

                {qrUrl ? (
                    <div style={{ textAlign: "center" }}>
                        {/* 二维码容器，过期时添加模糊效果 */}
                        <div
                            style={{
                                position: "relative",
                                display: "inline-block",
                                width: "100%",
                            }}
                        >
                            <img
                                src={qrUrl}
                                alt="二维码"
                                style={{
                                    maxWidth: "100%",
                                    height: "auto",
                                    border: "1px solid #ccc",
                                    borderRadius: "4px",
                                    filter: isExpired ? "blur(8px)" : "none",
                                    opacity: isExpired ? 0.6 : 1,
                                    transition: "all 0.3s ease",
                                }}
                            />
                            {/* 过期时显示刷新按钮覆盖在二维码上 */}
                            {isExpired && (
                                <div
                                    style={{
                                        position: "absolute",
                                        top: "50%",
                                        left: "50%",
                                        transform: "translate(-50%, -50%)",
                                    }}
                                >
                                    <Button
                                        onClick={() => void generateQR()}
                                        loading={isLoading}
                                        size="md"
                                    >
                                        点击刷新
                                    </Button>
                                </div>
                            )}
                        </div>
                        <Text size="sm" style={{ color: derived?.textColorSecondary }} mt="md">
                            请使用 B站 APP 扫描二维码
                        </Text>
                    </div>
                ) : (
                    <Group justify="center">
                        <Loader size="lg" />
                    </Group>
                )}
            </Stack>
        </ThemedModal>
    );
}
