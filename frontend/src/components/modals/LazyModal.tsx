import React, { Suspense } from "react";
import { Modal, Loader, Center } from "@mantine/core";

interface LazyModalProps {
    opened: boolean;
    onClose: () => void;
    children: React.ReactNode;
    title?: string;
    size?: string;
    centered?: boolean;
    styles?: any;
    overlayProps?: any;
    radius?: any;
}

/**
 * 懒加载弹窗容器组件
 * 只在弹窗打开时才渲染内容，提高性能
 */
const LazyModal: React.FC<LazyModalProps> = React.memo(({
    opened,
    onClose,
    children,
    title,
    size = "md",
    centered = true,
    styles,
    overlayProps,
    radius,
}) => {
    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={title}
            size={size}
            centered={centered}
            styles={styles}
            overlayProps={overlayProps}
            radius={radius}
        >
            {opened && (
                <Suspense fallback={
                    <Center p="xl">
                        <Loader size="sm" />
                    </Center>
                }>
                    {children}
                </Suspense>
            )}
        </Modal>
    );
});

export default LazyModal;