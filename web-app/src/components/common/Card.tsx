import React from 'react';
import {
  Card as MuiCard,
  CardContent,
  CardActions,
  CardHeader,
  CardMedia,
  Divider,
} from '@mui/material';
import { IBaseComponent } from './IComponent';

/**
 * Card component props following Interface Segregation Principle
 */
export interface ICardProps extends IBaseComponent {
  /**
   * Card title
   */
  title?: string;

  /**
   * Card subtitle
   */
  subtitle?: string;

  /**
   * Card header action
   */
  headerAction?: React.ReactNode;

  /**
   * Card media (image)
   */
  media?: {
    image: string;
    alt: string;
    height?: number;
  };

  /**
   * Card content
   */
  children: React.ReactNode;

  /**
   * Card actions (buttons, etc.)
   */
  actions?: React.ReactNode;

  /**
   * Whether to show divider between content and actions
   */
  showDivider?: boolean;

  /**
   * Card elevation (shadow depth)
   */
  elevation?: number;

  /**
   * Card variant
   */
  variant?: 'elevation' | 'outlined';

  /**
   * Click handler for the entire card
   */
  onClick?: () => void;
}

/**
 * Card component following Open-Closed Principle
 * Can be extended with different layouts without modifying existing code
 */
export const Card: React.FC<ICardProps> = ({
  title,
  subtitle,
  headerAction,
  media,
  children,
  actions,
  showDivider = false,
  elevation = 1,
  variant = 'elevation',
  onClick,
  className,
  testId,
  disabled = false,
}) => {
  return (
    <MuiCard
      elevation={variant === 'elevation' ? elevation : 0}
      variant={variant}
      onClick={onClick}
      className={className}
      data-testid={testId}
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        opacity: disabled ? 0.6 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
      }}
    >
      {(title || subtitle || headerAction) && (
        <CardHeader title={title} subheader={subtitle} action={headerAction} />
      )}

      {media && (
        <CardMedia
          component="img"
          height={media.height || 200}
          image={media.image}
          alt={media.alt}
        />
      )}

      <CardContent>{children}</CardContent>

      {actions && (
        <>
          {showDivider && <Divider />}
          <CardActions>{actions}</CardActions>
        </>
      )}
    </MuiCard>
  );
};
