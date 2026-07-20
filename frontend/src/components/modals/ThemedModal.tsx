import React, { forwardRef } from "react";
import { Modal, type ModalProps } from "@mantine/core";
import type { DerivedStyles } from "../../types";

export interface ThemedModalProps extends ModalProps {
    derived?: DerivedStyles;
}

const ThemedModal = forwardRef<HTMLDivElement, ThemedModalProps>(({
    derived,
    radius,
    styles,
    ...props
}, ref) => {
    const modalBackground = derived?.modalBackground;
    const textColor = derived?.textColorPrimary;
    const blur = derived?.modalBlur ?? 0;
    const backdropFilter = blur > 0 ? `blur(${blur}px)` : undefined;

    return (
        <Modal
            ref={ref}
            radius={radius ?? derived?.modalRadius}
            styles={{
                root: {
                    color: textColor,
                    ...styles?.root,
                },
                inner: {
                    backgroundColor: "transparent",
                    ...styles?.inner,
                },
                content: {
                    backgroundColor: modalBackground,
                    color: textColor,
                    backdropFilter,
                    WebkitBackdropFilter: backdropFilter,
                    ...styles?.content,
                },
                header: {
                    backgroundColor: modalBackground,
                    color: textColor,
                    ...styles?.header,
                },
                body: {
                    backgroundColor: modalBackground,
                    color: textColor,
                    ...styles?.body,
                },
                title: {
                    color: textColor,
                    fontWeight: 600,
                    ...styles?.title,
                },
                close: {
                    backgroundColor: derived?.controlBackground,
                    color: textColor,
                    ...styles?.close,
                },
                overlay: styles?.overlay,
            }}
            {...props}
        />
    );
});

ThemedModal.displayName = "ThemedModal";

export default ThemedModal;
